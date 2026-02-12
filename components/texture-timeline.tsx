const TEXTURE_STEPS = [
  {
    age: "4-6 mois (repère France)",
    text: "Début de diversification, purée/compote lisse."
  },
  {
    age: "6-8 mois",
    text: "Écrasé ou haché grossier, purée granuleuse."
  },
  {
    age: "8-10 mois",
    text: "Petits morceaux très mous/fondants."
  },
  {
    age: "10-12 mois",
    text: "Morceaux à croquer, transition vers presque comme les parents."
  },
  {
    age: "Vers 12 mois",
    text: "La plupart des enfants peuvent manger comme la famille (adapté pour la sécurité)."
  }
];

export function TextureTimeline(): JSX.Element {
  return (
    <section className="texture-timeline" aria-label="Progression des textures alimentaires">
      <h2 className="texture-timeline-title">🧩 Progression des textures (anti purée trop longue)</h2>

      <ol className="texture-timeline-track">
        {TEXTURE_STEPS.map((step) => (
          <li key={step.age} className="texture-step">
            <p className="texture-step-age">{step.age}</p>
            <p className="texture-step-text">{step.text}</p>
          </li>
        ))}
      </ol>

      <p className="texture-key-message">
        Ne pas rester bloqué trop longtemps en purée lisse : la progression des textures est
        importante pour l&apos;acceptation alimentaire et la mastication.
      </p>

      <div className="texture-sources">
        <h3>Sources</h3>
        <ul>
          <li>
            <a
              href="https://www.mangerbouger.fr/site/manger-mieux/a-tout-age-et-a-chaque-etape-de-la-vie/jeunes-enfants-de-0-a-3-ans-du-lait-a-la-diversification/a-partir-de-6-8-mois-on-touche-on-mache-on-decouvre-de-nouvelles-textures"
              target="_blank"
              rel="noreferrer"
            >
              MangerBouger - repères textures 6/8, 8 et 10 mois
            </a>
          </li>
          <li>
            <a
              href="https://www.mangerbouger.fr/site/content/download/1498/file/Tableau_diversification_alimentaire_jusqu%27a_3_ans.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Tableau officiel diversification jusqu&apos;à 3 ans (MangerBouger)
            </a>
          </li>
          <li>
            <a
              href="https://www.who.int/health-topics/complementary-feeding"
              target="_blank"
              rel="noreferrer"
            >
              WHO - Complementary feeding
            </a>
          </li>
          <li>
            <a href="https://pubmed.ncbi.nlm.nih.gov/19161546/" target="_blank" rel="noreferrer">
              ALSPAC (PubMed 2009) - introduction tardive des textures et difficultés alimentaires
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}
