import { requireVerifiedAuth } from "@/lib/auth";
import { CATEGORY_TONE_BY_NAME } from "@/lib/category-ui";
import { getChildProfile, getDashboardData } from "@/lib/data";
import { CategoriesGrid } from "@/components/categories-grid";
import { hasPremiumFeatureAccess } from "@/lib/premium-features";
import { SiteNav } from "@/components/site-nav";
import type { DashboardCategory, ProgressSummary } from "@/lib/types";

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
  const user = await requireVerifiedAuth();
  const hasWeeklyPlanPremiumAccess = hasPremiumFeatureAccess(user, "weekly_discovery_plan");
  let childProfile: Awaited<ReturnType<typeof getChildProfile>> = null;

  let categories: Awaited<ReturnType<typeof getDashboardData>> = [];
  let dbError: string | null = null;
  try {
    [childProfile, categories] = await Promise.all([
      getChildProfile(user.id),
      getDashboardData(user.id)
    ]);
  } catch (error) {
    console.error("[dashboard] Failed to load data.", error);
    dbError = "Impossible de charger les données pour le moment.";
    categories = [];
  }

  const progressSummary = buildProgressSummary(categories);
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
          <h2>Données temporairement indisponibles</h2>
          <p>{dbError}</p>
        </section>
      ) : null}

      <CategoriesGrid
        categories={categories}
        toneByCategory={CATEGORY_TONE_BY_NAME}
        childFirstName={childProfile?.firstName ?? null}
        hasWeeklyPlanPremiumAccess={hasWeeklyPlanPremiumAccess}
      />
    </main>
  );
}
