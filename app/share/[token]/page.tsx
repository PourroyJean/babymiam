import { unstable_noStore as noStore } from "next/cache";
import { verifyPublicShareAccessToken } from "@/lib/auth";
import { CATEGORY_TONE_BY_NAME } from "@/lib/category-ui";
import { buildProgressSummary } from "@/lib/dashboard-read-model";
import {
  createPublicShareLinkOpenEvent,
  getChildProfile,
  getDashboardData,
  getPublicShareLinkByPublicId,
  isPublicShareLinkTokenCurrent
} from "@/lib/data";
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
  const progressSummary = buildProgressSummary(categories);
  const firstName = childProfile?.firstName?.trim() || "";
  const completionRate =
    progressSummary.totalFoods > 0
      ? Math.round((progressSummary.introducedCount / progressSummary.totalFoods) * 100)
      : 0;
  const expiresAtLabel = formatExpiryDate(link.expiresAt);

  try {
    await createPublicShareLinkOpenEvent(link.ownerId, link.publicId, {
      publicId: link.publicId,
      introducedCount: progressSummary.introducedCount,
      totalFoods: progressSummary.totalFoods,
      likedCount: progressSummary.likedCount
    });
  } catch (error) {
    console.error("[share] Failed to track public share open.", error);
  }

  return (
    <main className="share-public-page">
      <section className="share-public-card share-public-card-live">
        <p className="share-public-kicker">Recap partage depuis Grrrignote</p>
        <h1>{firstName ? `Les progrès de ${firstName}` : "Progression diversification"}</h1>
        <p className="share-public-subtitle">
          Un parent partage ce suivi alimentaire en lecture seule.
        </p>
        {expiresAtLabel ? <p className="share-public-subtitle">Lien valide jusqu&apos;au {expiresAtLabel}.</p> : null}

        <section className="share-public-stats" aria-label="Statistiques de progression">
          <article>
            <h2>{progressSummary.introducedCount}</h2>
            <p>aliments testés</p>
          </article>
          <article>
            <h2>{progressSummary.likedCount}</h2>
            <p>aliments appréciés</p>
          </article>
          <article>
            <h2>{completionRate}%</h2>
            <p>du tableau complété</p>
          </article>
        </section>

        {progressSummary.recentFoodNames.length > 0 ? (
          <section className="share-public-recent">
            <h2>Derniers essais</h2>
            <ul>
              {progressSummary.recentFoodNames.map((food) => (
                <li key={food}>{food}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <PublicShareDashboard
          categories={categories}
          toneByCategory={CATEGORY_TONE_BY_NAME}
          childFirstName={childProfile?.firstName ?? null}
        />

        <div className="share-public-actions">
          <a href="/login" className="share-public-primary-link">
            Ouvrir Grrrignote
          </a>
          <p>Ce lien donne accès au suivi en direct, sans connexion ni modification possible.</p>
        </div>
      </section>
    </main>
  );
}
