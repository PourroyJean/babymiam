import { requireVerifiedAuth } from "@/lib/auth";
import { getChildProfile } from "@/lib/data";
import { SiteNav } from "@/components/site-nav";
import { TextureTimeline } from "@/components/texture-timeline";

export default async function BlogPage() {
  const user = await requireVerifiedAuth();

  let childProfile: Awaited<ReturnType<typeof getChildProfile>> = null;
  let dbError: string | null = null;

  try {
    childProfile = await getChildProfile(user.id);
  } catch (error) {
    console.error("[blog] Failed to load child profile.", error);
    dbError = "Le profil enfant ne peut pas être chargé pour le moment.";
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
          <p>{dbError}</p>
        </section>
      ) : null}

      <section className="blog-toc" aria-label="Sommaire du blog">
        <h2>Navigation rapide</h2>
        <nav className="blog-toc-links">
          <a href="#allergenes-europe">Allergènes en Europe</a>
          <a href="#conseils">Conseils</a>
          <a href="#guide-allergenes">Guide allergènes</a>
        </nav>
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
                y compris oeuf, arachide et gluten, selon l&apos;avis médical.
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

      <section id="guide-allergenes" className="blog-section">
        <h2>Guide pratique allergènes</h2>
        <div className="allergenes-split">
          <article className="blog-article">
            <h3>Comment introduire les allergènes de façon sûre et efficace</h3>
            <p>
              Les recommandations ont évolué: aujourd&apos;hui, l&apos;objectif est une introduction précoce
              et régulière des allergènes, avec des textures adaptées, pour favoriser la tolérance.
            </p>

            <h3>1. Fenêtre d&apos;introduction: 4 à 6 mois</h3>
            <ul className="blog-list">
              <li>La diversification commence en général autour de 6 mois, jamais avant 4 mois révolus.</li>
              <li>
                Une fois la diversification commencée, il n&apos;est plus recommandé de retarder les allergènes
                majeurs.
              </li>
              <li>
                Pour l&apos;arachide chez les bébés à haut risque (eczéma sévère et/ou allergie à l&apos;oeuf),
                une introduction entre 4 et 6 mois peut être discutée avec un professionnel de santé.
              </li>
            </ul>

            <h3>2. Introduire un allergène à la fois, en petites quantités</h3>
            <ul className="blog-list">
              <li>Proposer un nouvel allergène seul au départ pour identifier plus facilement une réaction.</li>
              <li>Commencer par une très petite quantité, puis augmenter progressivement si tout va bien.</li>
              <li>
                Choisir un moment de la journée où l&apos;on peut observer l&apos;enfant tranquillement après le repas.
              </li>
            </ul>

            <h3>3. Maintenir une exposition régulière après tolérance</h3>
            <ul className="blog-list">
              <li>Une introduction unique ne suffit pas: la régularité est importante pour maintenir la tolérance.</li>
              <li>
                Il n&apos;y a pas de dose universelle validée pour tous les allergènes, mais les experts conseillent
                de proposer régulièrement (au moins chaque semaine quand c&apos;est possible).
              </li>
              <li>Éviter le schéma &quot;test une fois puis arrêt prolongé&quot;.</li>
            </ul>

            <h3>4. Adapter les textures pour éviter l&apos;étouffement</h3>
            <ul className="blog-list">
              <li>Pas de cacahuètes ou fruits à coque entiers chez le jeune enfant (risque d&apos;étouffement).</li>
              <li>Arachide/noix: préférer beurre dilué, poudre fine mélangée, ou purées lisses adaptées à l&apos;âge.</li>
              <li>Au début: textures lisses ou écrasées; progression graduelle selon les capacités de mastication.</li>
            </ul>

            <h3>5. Points pratiques par allergène fréquent</h3>
            <ul className="blog-list">
              <li>Oeuf: privilégier l&apos;oeuf bien cuit (pas cru au début).</li>
              <li>
                Lait de vache: possible comme ingrédient (yaourt, fromage, préparation), mais pas comme boisson
                principale avant 12 mois.
              </li>
              <li>
                Gluten: peut être introduit entre 4 et 12 mois; le retarder n&apos;a pas montré de bénéfice en
                prévention de la maladie cœliaque.
              </li>
            </ul>

            <h3>6. Surveiller les réactions: légère vs urgence</h3>
            <ul className="blog-list">
              <li>
                Réaction légère possible: quelques plaques/urticaire localisé, inconfort digestif modéré, sans
                gêne respiratoire.
              </li>
              <li>
                Signes d&apos;urgence: gêne respiratoire, voix rauque, gonflement langue/lèvres, malaise, vomissements
                répétés. Appeler immédiatement les urgences (15 ou 112).
              </li>
              <li>
                En cas d&apos;eczéma sévère, d&apos;allergie déjà connue ou de doute, demander un avis médical avant
                d&apos;introduire un nouvel allergène.
              </li>
            </ul>

            <p>
              Ce guide informe et ne remplace pas un avis médical personnalisé.
            </p>
          </article>

          <aside id="allergenes-europe" className="blog-aside">
            <h3>Les 14 allergènes à déclaration obligatoire en Europe</h3>
            <p>
              Cette liste correspond aux allergènes qui doivent être signalés dans l&apos;information au
              consommateur dans l&apos;Union européenne.
            </p>
            <ul className="blog-list">
              <li>Céréales contenant du gluten (blé, seigle, orge, avoine, épeautre, kamut)</li>
              <li>Crustacés</li>
              <li>Oeufs</li>
              <li>Poissons</li>
              <li>Arachides</li>
              <li>Soja</li>
              <li>Lait (y compris lactose)</li>
              <li>Fruits à coque (amande, noisette, noix, cajou, pécan, Brésil, pistache, macadamia)</li>
              <li>Céleri</li>
              <li>Moutarde</li>
              <li>Graines de sésame</li>
              <li>Anhydride sulfureux et sulfites (&gt; 10 mg/kg ou 10 mg/L)</li>
              <li>Lupin</li>
              <li>Mollusques</li>
            </ul>

            <div className="blog-aside-sources">
              <h4>Sources allergènes (février 2026)</h4>
              <ul className="blog-list">
                <li>
                  <a
                    href="https://www.mangerbouger.fr/site/ressources-pros/ressources-documents-mooc-liens-utiles/professionnels-de-sante/introduire-les-allergenes-alimentaires-des-4-6-mois"
                    target="_blank"
                    rel="noreferrer"
                  >
                    MangerBouger (Santé publique France): introduire les allergènes dès 4/6 mois
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/when-what-and-how-to-introduce-solid-foods.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CDC (20 mars 2025): introduction des solides et allergènes
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.niaid.nih.gov/sites/default/files/peanut-allergy-prevention-guidelines-clinician-summary.pdf"
                    target="_blank"
                    rel="noreferrer"
                  >
                    NIAID: recommandations arachide (nourrissons à haut risque)
                  </a>
                </li>
                <li>
                  <a href="https://pubmed.ncbi.nlm.nih.gov/33710678/" target="_blank" rel="noreferrer">
                    EAACI 2020: prévention de l&apos;allergie alimentaire
                  </a>
                </li>
                <li>
                  <a href="https://pubmed.ncbi.nlm.nih.gov/28027215/" target="_blank" rel="noreferrer">
                    ESPGHAN 2017: diversification et introduction du gluten (4-12 mois)
                  </a>
                </li>
                <li>
                  <a href="https://pubmed.ncbi.nlm.nih.gov/38847232/" target="_blank" rel="noreferrer">
                    ESPGHAN 2024: mise à jour sur gluten et risque cœliaque
                  </a>
                </li>
                <li>
                  <a href="https://www.nhs.uk/best-start-in-life/baby/weaning/safe-weaning/food-allergies/" target="_blank" rel="noreferrer">
                    NHS: allergènes, signes de réaction et conduite pratique
                  </a>
                </li>
                <li>
                  <a
                    href="https://aacijournal.biomedcentral.com/articles/10.1186/s13223-023-00814-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CSACI 2023: importance de l&apos;ingestion régulière après introduction
                  </a>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
