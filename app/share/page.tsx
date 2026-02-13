import Link from "next/link";
import { createGrowthEvent } from "@/lib/data";

type RawSearchParams = Record<string, string | string[] | undefined>;

const MAX_RECENT_FOODS = 3;
const MAX_FIRST_NAME_LENGTH = 40;
const MAX_FOOD_NAME_LENGTH = 30;
const SHARE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export const dynamic = "force-dynamic";

function getSingleParam(searchParams: RawSearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function getSafeInteger(
  searchParams: RawSearchParams,
  key: string,
  fallback: number,
  minValue: number,
  maxValue: number
) {
  const raw = Number(getSingleParam(searchParams, key));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(minValue, Math.min(maxValue, Math.trunc(raw)));
}

function getSafeFirstName(searchParams: RawSearchParams) {
  return getSingleParam(searchParams, "n").slice(0, MAX_FIRST_NAME_LENGTH);
}

function getSafeRecentFoods(searchParams: RawSearchParams) {
  const raw = getSingleParam(searchParams, "r");
  if (!raw) return [];

  return raw
    .split("|")
    .map((food) => food.trim().slice(0, MAX_FOOD_NAME_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_RECENT_FOODS);
}

function getSafeShareId(searchParams: RawSearchParams) {
  const shareId = getSingleParam(searchParams, "sid");
  if (!SHARE_ID_PATTERN.test(shareId)) return null;
  return shareId;
}

export default async function SharedSnapshotPage({
  searchParams
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;

  const firstName = getSafeFirstName(params);
  const introducedCount = getSafeInteger(params, "i", 0, 0, 500);
  const totalFoods = getSafeInteger(params, "t", 0, 0, 500);
  const likedCount = getSafeInteger(params, "l", 0, 0, 500);
  const milestone = getSafeInteger(params, "m", 0, 0, 500);
  const recentFoods = getSafeRecentFoods(params);
  const shareId = getSafeShareId(params);

  const normalizedTotalFoods = Math.max(totalFoods, introducedCount);
  const completionRate =
    normalizedTotalFoods > 0 ? Math.round((introducedCount / normalizedTotalFoods) * 100) : 0;

  if (shareId) {
    try {
      await createGrowthEvent("__public__", "snapshot_link_opened", "public_page", {
        shareId,
        introducedCount,
        totalFoods: normalizedTotalFoods,
        likedCount,
        milestone
      });
    } catch {
      // Public share pages should remain accessible even if tracking fails.
    }
  }

  return (
    <main className="share-public-page">
      <section className="share-public-card">
        <p className="share-public-kicker">Recap partage depuis Grrrignote</p>
        <h1>
          {firstName ? `Les progres de ${firstName}` : "Progression diversification"}
        </h1>
        <p className="share-public-subtitle">
          Un parent a partage ce suivi alimentaire. Tu peux lancer le tien en quelques minutes.
        </p>

        {milestone > 0 ? (
          <p className="share-public-milestone">Nouveau palier atteint: {milestone} aliments</p>
        ) : null}

        <section className="share-public-stats" aria-label="Statistiques de progression">
          <article>
            <h2>{introducedCount}</h2>
            <p>aliments testes</p>
          </article>
          <article>
            <h2>{likedCount}</h2>
            <p>aliments apprecies</p>
          </article>
          <article>
            <h2>{completionRate}%</h2>
            <p>du tableau complete</p>
          </article>
        </section>

        {recentFoods.length > 0 ? (
          <section className="share-public-recent">
            <h2>Derniers essais</h2>
            <ul>
              {recentFoods.map((food) => (
                <li key={food}>{food}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="share-public-actions">
          <Link href="/login" className="share-public-primary-link">
            Ouvrir Grrrignote
          </Link>
          <p>Deja un acces ? Connecte-toi pour reprendre ton suivi.</p>
        </div>
      </section>
    </main>
  );
}
