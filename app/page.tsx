import { requireAuth } from "@/lib/auth";
import { CATEGORY_TONE_BY_NAME } from "@/lib/category-ui";
import { getChildProfile, getDashboardData, getFoodTimeline } from "@/lib/data";
import { buildTextureCoachSnapshot } from "@/lib/texture-coach";
import { CategoriesGrid } from "@/components/categories-grid";
import { SiteNav } from "@/components/site-nav";
import type { DashboardCategory, FoodTimelineEntry, ProgressSummary } from "@/lib/types";

function getUpdatedTimestamp(updatedAt: string | null) {
  if (!updatedAt) return 0;
  const parsed = Date.parse(updatedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildProgressSummary(categories: DashboardCategory[]): ProgressSummary {
  const foods = categories.flatMap((category) => category.foods);
  const introducedCount = foods.filter((food) => food.tastingCount > 0).length;
  const likedCount = foods.filter((food) => food.finalPreference === 1).length;
  const recentFoodNames = foods
    .filter((food) => food.updatedAt)
    .sort((a, b) => getUpdatedTimestamp(b.updatedAt) - getUpdatedTimestamp(a.updatedAt))
    .slice(0, 3)
    .map((food) => food.name);

  return {
    introducedCount,
    totalFoods: foods.length,
    likedCount,
    recentFoodNames
  };
}

export default async function DashboardPage() {
  const user = await requireAuth();
  let childProfile: Awaited<ReturnType<typeof getChildProfile>> = null;

  let categories: Awaited<ReturnType<typeof getDashboardData>> = [];
  let timelineEntries: FoodTimelineEntry[] = [];
  let dbError: string | null = null;
  try {
    childProfile = await getChildProfile(user.id);
    categories = await getDashboardData(user.id);
    timelineEntries = await getFoodTimeline(user.id);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Erreur inconnue de connexion à la base.";
    categories = [];
    timelineEntries = [];
  }

  const progressSummary = buildProgressSummary(categories);
  const textureCoach = buildTextureCoachSnapshot({
    birthDate: childProfile?.birthDate,
    timelineEntries
  });
  const dashboardTitle = `Les premiers aliments de ${childProfile?.firstName ?? "bébé"}`;

  return (
    <main className="dashboard-page">
      <SiteNav
        activePage="suivi"
        childProfile={childProfile}
        progressSummary={progressSummary}
        contextTitle={dashboardTitle}
      />

      {dbError ? (
        <section className="db-warning">
          <h2>Base locale non disponible</h2>
          <p>
            Lance Postgres en local avec <code>docker compose up -d</code>, puis recharge la page.
          </p>
          <p>
            Vérifie aussi <code>POSTGRES_URL</code> dans <code>.env.local</code>.
          </p>
          <pre>{dbError}</pre>
        </section>
      ) : null}

      <CategoriesGrid
        categories={categories}
        toneByCategory={CATEGORY_TONE_BY_NAME}
        childFirstName={childProfile?.firstName ?? null}
        timelineEntries={timelineEntries}
        textureCoach={textureCoach}
      />
    </main>
  );
}
