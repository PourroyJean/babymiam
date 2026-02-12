import { redirect } from "next/navigation";
import { clearSession, isAuthenticated, requireAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
import { FoodRow } from "@/components/food-row";

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

async function logoutAction() {
  "use server";
  clearSession();
  redirect("/login");
}

export default async function DashboardPage() {
  requireAuth();
  if (!isAuthenticated()) {
    redirect("/login");
  }

  let categories: Awaited<ReturnType<typeof getDashboardData>> = [];
  let dbError: string | null = null;
  try {
    categories = await getDashboardData();
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Erreur inconnue de connexion à la base.";
    categories = [];
  }

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div>
          <h1>Les premiers aliments de Louise</h1>
          <p>Suivi de la diversification alimentaire</p>
        </div>

        <form action={logoutAction}>
          <button type="submit" className="logout-btn">
            Déconnexion
          </button>
        </form>
      </header>

      <section className="speech-grid">
        <article>
          <h2>🍎 À quoi sert cette liste</h2>
          <p>
            Elle permet de suivre la diversification alimentaire de bébé à la maison et lorsqu&apos;il est
            gardé à l&apos;extérieur.
          </p>
        </article>

        <article>
          <h2>🍋 De quoi est-elle composée</h2>
          <p>
            Il y a 12 catégories d&apos;aliments dont une vierge à remplir, soit environ 250 aliments.
            La catégorie des allergènes majeurs est à introduire progressivement.
          </p>
          <p>
            Un enfant peut commencer à découvrir toutes les familles d&apos;aliments entre 4 et 6 mois,
            y compris œuf, arachide et gluten, selon l&apos;avis médical.
          </p>
          <p>
            Source : <a href="https://www.mangerbouger.fr" target="_blank" rel="noreferrer">mangerbouger.fr</a>
          </p>
          <p>
            Pour toute question, rapprochez-vous d&apos;un pédiatre, médecin traitant ou spécialiste de la nutrition.
          </p>
        </article>

        <article>
          <h2>🥦 Pourquoi 3 ronds</h2>
          <p>
            Coche un rond dès que bébé est en contact avec l&apos;aliment. Tu peux aussi utiliser + ou -
            pour suivre si bébé a aimé.
          </p>
          <p>
            Introduis chaque aliment en petite quantité au début pour observer la réaction de bébé.
          </p>
        </article>
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

      <section className="categories-grid">
        {categories.map((category) => (
          <article
            key={category.id}
            className={`category-card ${toneByCategory[category.name] || "tone-other"}`}
          >
            <h3 className="category-pill">{category.name}</h3>
            <ul>
              {category.foods.map((food) => (
                <FoodRow
                  key={food.id}
                  foodId={food.id}
                  name={food.name}
                  exposureCount={food.exposureCount}
                  preference={food.preference}
                  firstTastedOn={food.firstTastedOn}
                  note={food.note}
                />
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
