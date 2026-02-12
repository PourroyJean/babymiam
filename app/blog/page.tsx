import { getAuthenticatedUsername, requireAuth } from "@/lib/auth";
import { getChildProfile } from "@/lib/data";
import { SiteNav } from "@/components/site-nav";
import { TextureTimeline } from "@/components/texture-timeline";

export default async function BlogPage() {
  await requireAuth();
  const ownerKey = await getAuthenticatedUsername();

  let childProfile: Awaited<ReturnType<typeof getChildProfile>> = null;
  let dbError: string | null = null;

  try {
    childProfile = await getChildProfile(ownerKey);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Erreur inconnue de connexion à la base.";
  }

  return (
    <main className="blog-page">
      <SiteNav activePage="blog" childProfile={childProfile} />

      <section className="blog-hero">
        <h1>Blog connaissance</h1>
        <p>Des repères pratiques sur la diversification, les allergènes et les bonnes habitudes.</p>
      </section>

      {dbError ? (
        <section className="db-warning">
          <h2>Profil enfant non disponible</h2>
          <p>La page reste consultable, mais le profil ne peut pas être chargé pour le moment.</p>
          <pre>{dbError}</pre>
        </section>
      ) : null}

      <section className="blog-toc" aria-label="Sommaire du blog">
        <h2>Navigation rapide</h2>
        <nav className="blog-toc-links">
          <a href="#allergenes-europe">Allergènes en Europe</a>
          <a href="#conseils">Conseils</a>
          <a href="#article">Article</a>
        </nav>
      </section>

      <section id="allergenes-europe" className="blog-section">
        <h2>Allergènes en Europe</h2>
        <p>
          Les allergènes doivent être introduits progressivement et observés avec attention.
          L&apos;objectif n&apos;est pas d&apos;éviter à long terme, mais de proposer tôt et de façon adaptée
          selon les recommandations médicales.
        </p>
        <ul className="blog-list">
          <li>Gluten (blé, seigle, orge, avoine)</li>
          <li>Œuf</li>
          <li>Arachide</li>
          <li>Lait et produits laitiers</li>
          <li>Fruits à coque (amande, noisette, noix, etc.)</li>
          <li>Poisson, crustacés, mollusques</li>
          <li>Soja</li>
          <li>Sésame, moutarde, céleri</li>
        </ul>
        <p className="blog-note">
          En cas de doute, d&apos;antécédents familiaux ou de réaction suspecte, demande rapidement l&apos;avis
          d&apos;un professionnel de santé.
        </p>
      </section>

      <section id="conseils" className="blog-section">
        <h2>Conseils pratiques</h2>

        <section className="info-layout">
          <section className="speech-grid">
            <article>
              <h3>🍎 À quoi sert cette liste</h3>
              <p>
                Elle permet de suivre la diversification alimentaire de bébé à la maison et
                lorsqu&apos;il est gardé à l&apos;extérieur.
              </p>
            </article>

            <article>
              <h3>🍋 De quoi est-elle composée</h3>
              <p>
                Il y a 12 catégories d&apos;aliments dont une vierge à remplir, soit environ 250 aliments.
                La catégorie des allergènes majeurs est à introduire progressivement.
              </p>
              <p>
                Un enfant peut commencer à découvrir toutes les familles d&apos;aliments entre 4 et 6 mois,
                y compris œuf, arachide et gluten, selon l&apos;avis médical.
              </p>
              <p>
                Source :{" "}
                <a href="https://www.mangerbouger.fr" target="_blank" rel="noreferrer">
                  mangerbouger.fr
                </a>
              </p>
              <p>
                Pour toute question, rapproche-toi d&apos;un pédiatre, médecin traitant ou spécialiste de la
                nutrition.
              </p>
            </article>

            <article>
              <h3>🥦 Pourquoi 3 ronds</h3>
              <p>
                Coche un rond dès que bébé est en contact avec l&apos;aliment. Tu peux aussi utiliser + ou -
                pour suivre si bébé a aimé.
              </p>
              <p>
                Introduis chaque aliment en petite quantité au début pour observer la réaction de bébé.
              </p>
            </article>
          </section>

          <TextureTimeline />
        </section>
      </section>

      <section id="article" className="blog-section">
        <h2>Article</h2>
        <article className="blog-article">
          <h3>Introduire un nouvel aliment en 3 étapes</h3>
          <p>
            Une approche simple et régulière aide bébé à accepter de nouvelles saveurs sans stress.
            L&apos;idée est d&apos;observer, noter et réessayer.
          </p>
          <ol>
            <li>Proposer une petite quantité, dans un moment calme.</li>
            <li>Observer 2-3 jours et noter la tolérance dans le suivi.</li>
            <li>Représenter l&apos;aliment plusieurs fois, même en cas de refus initial.</li>
          </ol>
          <p>
            Les refus ponctuels sont normaux. La régularité et la variété progressives sont plus utiles
            qu&apos;une seule prise importante.
          </p>
        </article>
      </section>
    </main>
  );
}
