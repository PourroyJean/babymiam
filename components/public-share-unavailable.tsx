import Link from "next/link";

export function PublicShareUnavailable() {
  return (
    <main className="share-public-page">
      <section className="share-public-card share-public-card-compact">
        <p className="share-public-kicker">Recap partage depuis Grrrignote</p>
        <h1>Lien de partage indisponible</h1>
        <p className="share-public-subtitle">Ce lien est invalide, expiré, ou n&apos;est plus disponible.</p>

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
