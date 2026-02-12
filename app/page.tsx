import { getAuthenticatedUsername, requireAuth } from "@/lib/auth";
import { getChildProfile, getDashboardData } from "@/lib/data";
import { CategoriesGrid } from "@/components/categories-grid";
import { SiteNav } from "@/components/site-nav";

const toneByCategory: Record<string, string> = {
  "Légumes": "tone-vegetables",
  "Fruits": "tone-fruits",
  "Féculents": "tone-starch",
  "Protéines": "tone-proteins",
  "Légumineuses": "tone-legumes",
  "Produits laitiers": "tone-dairy",
  "Allergènes majeurs": "tone-allergens",
  "Épices": "tone-spices",
  "Oléagineux et huiles": "tone-oils",
  "Herbes et aromates": "tone-herbs",
  "Sucreries": "tone-sweets",
  "Condiments": "tone-condiments",
  "Autres": "tone-other"
};

export default async function DashboardPage() {
  await requireAuth();
  const ownerKey = await getAuthenticatedUsername();
  let childProfile: Awaited<ReturnType<typeof getChildProfile>> = null;

  let categories: Awaited<ReturnType<typeof getDashboardData>> = [];
  let dbError: string | null = null;
  try {
    childProfile = await getChildProfile(ownerKey);
    categories = await getDashboardData();
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Erreur inconnue de connexion à la base.";
    categories = [];
  }

  return (
    <main className="dashboard-page">
      <SiteNav activePage="suivi" childProfile={childProfile} />

      <section className="page-hero">
        <h1>Les premiers aliments de {childProfile?.firstName ?? "bébé"}</h1>
        <p>Suivi de la diversification alimentaire</p>
      </section>

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

      <CategoriesGrid categories={categories} toneByCategory={toneByCategory} />
    </main>
  );
}
