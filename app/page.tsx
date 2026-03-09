import { requireVerifiedAuth } from "@/lib/auth";
import { buildAgeGuidanceSnapshot } from "@/lib/age-guidance";
import { CATEGORY_TONE_BY_NAME } from "@/lib/category-ui";
import { buildProgressSummary } from "@/lib/dashboard-read-model";
import { getChildProfile, getDashboardData } from "@/lib/data";
import { CategoriesGrid } from "@/components/categories-grid";
import { hasPremiumAccess } from "@/lib/premium-features";
import { SiteNav } from "@/components/site-nav";

export default async function DashboardPage() {
  const user = await requireVerifiedAuth();
  const userHasPremiumAccess = hasPremiumAccess(user);
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
  const ageGuidance = await buildAgeGuidanceSnapshot({
    childProfile
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
          <h2>Données temporairement indisponibles</h2>
          <p>{dbError}</p>
        </section>
      ) : null}

      <CategoriesGrid
        ageGuidance={ageGuidance}
        categories={categories}
        toneByCategory={CATEGORY_TONE_BY_NAME}
        childFirstName={childProfile?.firstName ?? null}
        hasPremiumAccess={userHasPremiumAccess}
      />
    </main>
  );
}
