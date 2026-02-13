import Link from "next/link";
import { createGrowthEvent, getPublicShareSnapshotById } from "@/lib/data";

type RawSearchParams = Record<string, string | string[] | undefined>;

const SHARE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export const dynamic = "force-dynamic";

function getSingleParam(searchParams: RawSearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
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
  const shareId = getSafeShareId(params);

  let snapshot: Awaited<ReturnType<typeof getPublicShareSnapshotById>> = null;
  if (shareId) {
    try {
      snapshot = await getPublicShareSnapshotById(shareId);
    } catch {
      snapshot = null;
    }
  }

  if (snapshot && shareId) {
    try {
      await createGrowthEvent(
        snapshot.ownerId,
        "snapshot_link_opened",
        "public_page",
        {
          shareId,
          introducedCount: snapshot.introducedCount,
          totalFoods: snapshot.totalFoods,
          likedCount: snapshot.likedCount,
          milestone: snapshot.milestone
        },
        "public"
      );
    } catch {
      // Public share pages should remain accessible even if tracking fails.
    }
  }

  if (!snapshot) {
    return (
      <main className="share-public-page">
        <section className="share-public-card">
          <p className="share-public-kicker">Recap partage depuis Grrrignote</p>
          <h1>Lien de partage indisponible</h1>
          <p className="share-public-subtitle">
            Ce lien est invalide, expiré, ou n&apos;est plus public.
          </p>

          <div className="share-public-actions">
            <Link href="/login" className="share-public-primary-link">
              Ouvrir Grrrignote
            </Link>
            <p>Connecte-toi pour créer un nouveau lien de partage.</p>
          </div>
        </section>
      </main>
    );
  }

  const firstName = snapshot.firstName?.trim() || "";
  const normalizedTotalFoods = Math.max(snapshot.totalFoods, snapshot.introducedCount);
  const completionRate =
    normalizedTotalFoods > 0 ? Math.round((snapshot.introducedCount / normalizedTotalFoods) * 100) : 0;

  return (
    <main className="share-public-page">
      <section className="share-public-card">
        <p className="share-public-kicker">Recap partage depuis Grrrignote</p>
        <h1>{firstName ? `Les progres de ${firstName}` : "Progression diversification"}</h1>
        <p className="share-public-subtitle">
          Un parent a partage ce suivi alimentaire. Tu peux lancer le tien en quelques minutes.
        </p>

        {snapshot.milestone && snapshot.milestone > 0 ? (
          <p className="share-public-milestone">Nouveau palier atteint: {snapshot.milestone} aliments</p>
        ) : null}

        <section className="share-public-stats" aria-label="Statistiques de progression">
          <article>
            <h2>{snapshot.introducedCount}</h2>
            <p>aliments testes</p>
          </article>
          <article>
            <h2>{snapshot.likedCount}</h2>
            <p>aliments apprecies</p>
          </article>
          <article>
            <h2>{completionRate}%</h2>
            <p>du tableau complete</p>
          </article>
        </section>

        {snapshot.recentFoods.length > 0 ? (
          <section className="share-public-recent">
            <h2>Derniers essais</h2>
            <ul>
              {snapshot.recentFoods.map((food) => (
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
