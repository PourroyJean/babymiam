import { unstable_noStore as noStore } from "next/cache";
import { verifyPublicShareAccessToken } from "@/lib/auth";
import { CATEGORY_TONE_BY_NAME } from "@/lib/category-ui";
import {
  buildPublicShareCategoryFoodLists,
  buildPublicShareOverview,
  buildPublicSharePreferenceFoodLists,
  buildTimelineEntries
} from "@/lib/dashboard-read-model";
import { getCurrentIsoDate } from "@/lib/date-utils";
import {
  createPublicShareLinkOpenEvent,
  getChildProfile,
  getDashboardData,
  getPublicShareLinkByPublicId,
  isPublicShareLinkTokenCurrent
} from "@/lib/data";
import type { FinalPreferenceValue } from "@/lib/types";
import { PublicShareDashboard } from "@/components/public-share-dashboard";
import { PublicShareUnavailable } from "@/components/public-share-unavailable";

type PageParams = {
  token: string;
};

export const dynamic = "force-dynamic";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

function formatExpiryDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

async function resolvePublicSharePageData(token: string) {
  const verifiedToken = verifyPublicShareAccessToken(token);
  if (!verifiedToken) return null;

  let link = null;
  try {
    link = await getPublicShareLinkByPublicId(verifiedToken.publicId);
  } catch {
    return null;
  }

  if (!link) {
    return null;
  }

  if (
    !isPublicShareLinkTokenCurrent({
      link,
      publicId: verifiedToken.publicId,
      issuedAtEpochSeconds: verifiedToken.issuedAtEpochSeconds
    })
  ) {
    return null;
  }

  try {
    const [childProfile, categories] = await Promise.all([
      getChildProfile(link.ownerId),
      getDashboardData(link.ownerId)
    ]);

    return {
      link,
      childProfile,
      categories
    };
  } catch {
    return null;
  }
}

export default async function PublicSharePage({
  params
}: {
  params: Promise<PageParams>;
}) {
  noStore();

  const { token } = await params;
  const pageData = await resolvePublicSharePageData(token);
  if (!pageData) {
    return <PublicShareUnavailable />;
  }

  const { link, childProfile, categories } = pageData;
  const serverTodayIso = getCurrentIsoDate();
  const overview = buildPublicShareOverview(categories, serverTodayIso);
  const preferenceFoodLists = buildPublicSharePreferenceFoodLists(categories);
  const categoryFoodLists = buildPublicShareCategoryFoodLists(categories);
  const timelineEntries = buildTimelineEntries(categories);
  const tastingDates = timelineEntries.map((entry) => entry.tastedOn);
  const finalPreferenceByFoodId = Object.fromEntries(
    categories.flatMap((category) => category.foods.map((food) => [food.id, food.finalPreference] as const))
  ) as Record<number, FinalPreferenceValue>;
  const expiresAtLabel = formatExpiryDate(link.expiresAt);

  try {
    await createPublicShareLinkOpenEvent(link.ownerId, link.publicId, {
      publicId: link.publicId,
      introducedCount: overview.introducedCount,
      totalFoods: overview.totalFoods,
      completedCount: overview.completedCount,
      likedCount: overview.completedPreferenceCounts.liked,
      neutralCount: overview.completedPreferenceCounts.neutral,
      dislikedCount: overview.completedPreferenceCounts.disliked,
      totalTastings: overview.totalTastings
    });
  } catch (error) {
    console.error("[share] Failed to track public share open.", error);
  }

  return (
    <main className="share-public-page share-public-page-live">
      <PublicShareDashboard
        overview={overview}
        preferenceFoodLists={preferenceFoodLists}
        categoryFoodLists={categoryFoodLists}
        timelineEntries={timelineEntries}
        tastingDates={tastingDates}
        finalPreferenceByFoodId={finalPreferenceByFoodId}
        toneByCategory={CATEGORY_TONE_BY_NAME}
        childFirstName={childProfile?.firstName ?? null}
        expiresAtLabel={expiresAtLabel}
        serverTodayIso={serverTodayIso}
      />
    </main>
  );
}
