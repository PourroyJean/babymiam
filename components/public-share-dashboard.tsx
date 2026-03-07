import { getCategoryUi } from "@/lib/category-ui";
import type {
  FinalPreferenceValue,
  FoodTimelineEntry,
  PublicShareCategoryDiscovery,
  PublicShareOverview,
  PublicSharePreferenceCounts
} from "@/lib/types";
import { PublicShareCumulativeChartLive } from "@/components/public-share-cumulative-chart-live";
import { PublicShareTimelinePanel } from "@/components/public-share-timeline-panel";

type PublicShareDashboardProps = {
  overview: PublicShareOverview;
  timelineEntries: FoodTimelineEntry[];
  tastingDates: string[];
  finalPreferenceByFoodId: Record<number, FinalPreferenceValue>;
  toneByCategory: Record<string, string>;
  childFirstName?: string | null;
  expiresAtLabel: string | null;
  serverTodayIso: string;
};

type DonutDatum = {
  key: keyof PublicSharePreferenceCounts;
  label: string;
  value: number;
  color: string;
};

const DONUT_DATA: DonutDatum[] = [
  { key: "liked", label: "Aimés", value: 0, color: "#1b8f65" },
  { key: "neutral", label: "Neutres", value: 0, color: "#7a8097" },
  { key: "disliked", label: "Pas aimés", value: 0, color: "#cf5b73" }
];

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatTastingsLabel(value: number) {
  return `${value} dégustation${value === 1 ? "" : "s"}`;
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getCategoryPictogram(categoryName: string) {
  return getCategoryUi(categoryName).pictogram;
}

function buildDonutSegments(preferenceCounts: PublicSharePreferenceCounts) {
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const data = DONUT_DATA.map((entry) => ({
    ...entry,
    value: preferenceCounts[entry.key]
  }));
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  let progress = 0;

  const segments = data.map((entry) => {
    const segmentLength = total > 0 ? (entry.value / total) * circumference : 0;
    const segment = {
      ...entry,
      circumference,
      radius,
      strokeDasharray: `${segmentLength} ${circumference - segmentLength}`,
      strokeDashoffset: -progress
    };
    progress += segmentLength;
    return segment;
  });

  return { total, segments };
}

function PublicSharePreferenceChart({
  childLabel,
  preferenceCounts
}: {
  childLabel: string;
  preferenceCounts: PublicSharePreferenceCounts;
}) {
  const { total, segments } = buildDonutSegments(preferenceCounts);

  return (
    <section className="public-share-panel public-share-panel-chart" aria-labelledby="public-share-reactions-title">
      <header className="public-share-section-head">
        <div>
          <p className="public-share-section-kicker">Préférences finales</p>
          <h2 id="public-share-reactions-title">Comment {childLabel} réagit</h2>
        </div>
      </header>

      <div className="public-share-donut-layout">
        <div className="public-share-donut-visual">
          <svg
            className="public-share-donut"
            viewBox="0 0 220 220"
            role="img"
            aria-label={
              total > 0
                ? `${total} aliments validés: ${preferenceCounts.liked} aimés, ${preferenceCounts.neutral} neutres, ${preferenceCounts.disliked} pas aimés.`
                : "Aucun aliment validé pour le moment."
            }
          >
            <circle cx="110" cy="110" r="78" className="public-share-donut-track" />
            {segments.map((segment) =>
              segment.value > 0 ? (
                <circle
                  key={segment.key}
                  cx="110"
                  cy="110"
                  r={segment.radius}
                  className="public-share-donut-segment"
                  style={{
                    stroke: segment.color,
                    strokeDasharray: segment.strokeDasharray,
                    strokeDashoffset: `${segment.strokeDashoffset}`
                  }}
                />
              ) : null
            )}
          </svg>

          <div className="public-share-donut-center">
            <strong>{total}</strong>
            <span>validés</span>
          </div>
        </div>

        <ul className="public-share-donut-legend">
          {segments.map((segment) => {
            const share = total > 0 ? Math.round((segment.value / total) * 100) : 0;
            return (
              <li key={segment.key}>
                <span className="public-share-donut-legend-label">
                  <span className="public-share-donut-legend-dot" style={{ backgroundColor: segment.color }} />
                  {segment.label}
                </span>
                <strong>{segment.value}</strong>
                <span>{share}%</span>
              </li>
            );
          })}
        </ul>
      </div>

      {total === 0 ? <p className="public-share-chart-empty">Aucun aliment validé pour le moment.</p> : null}
    </section>
  );
}

function PublicShareCategoryChart({
  categoryDiscoveryCounts,
  toneByCategory
}: {
  categoryDiscoveryCounts: PublicShareCategoryDiscovery[];
  toneByCategory: Record<string, string>;
}) {
  return (
    <section
      className="public-share-panel public-share-panel-chart public-share-panel-chart-wide public-share-category-panel"
      aria-labelledby="public-share-categories-title"
    >
      <header className="public-share-section-head">
        <div>
          <p className="public-share-section-kicker">Répartition</p>
          <h2 id="public-share-categories-title">Découvertes par catégorie</h2>
        </div>
      </header>

      <ol className="public-share-category-bars">
        {categoryDiscoveryCounts.map((category) => (
          <li
            key={category.categoryId}
            className={`public-share-category-bar ${toneByCategory[category.categoryName] || "tone-other"}`}
          >
            <div className="public-share-category-bar-head">
              <p>
                <span aria-hidden="true">{getCategoryPictogram(category.categoryName)}</span>
                <span>{category.categoryName}</span>
              </p>
              <strong>
                {category.discoveredCount}/{category.totalCount}
              </strong>
            </div>

            <div
              className="public-share-category-meter"
              role="img"
              aria-label={`${category.categoryName}: ${category.discoveredCount} aliments découverts sur ${category.totalCount}.`}
            >
              <span style={{ width: `${clampPercentage(category.discoveredPercent)}%` }} aria-hidden="true" />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function PublicShareDashboard({
  overview,
  timelineEntries,
  tastingDates,
  finalPreferenceByFoodId,
  toneByCategory,
  childFirstName = null,
  expiresAtLabel,
  serverTodayIso
}: PublicShareDashboardProps) {
  const childLabel = childFirstName?.trim() || "bébé";
  const pageTitle = childFirstName?.trim() ? `Les progrès de ${childFirstName.trim()}` : "Les progrès de bébé";

  return (
    <section className="public-share-dashboard">
      <section className="public-share-hero" aria-labelledby="public-share-hero-title">
        <p className="public-share-hero-kicker">Suivi partagé en lecture seule</p>
        <h1 id="public-share-hero-title">{pageTitle}</h1>
        <p className="public-share-hero-copy">
          Un aperçu clair des découvertes culinaires de {childLabel}, pensé pour être partagé facilement avec la
          famille.
        </p>
        <div className="public-share-hero-meta">
          <span>{overview.introducedCount} aliments déjà explorés</span>
          <span>{formatTastingsLabel(overview.totalTastings)} enregistrée{overview.totalTastings === 1 ? "" : "s"}</span>
        </div>
      </section>

      <section className="public-share-kpi-grid" aria-label="Statistiques de progression">
        <article className="public-share-kpi-card public-share-kpi-card-primary">
          <p className="public-share-kpi-label">Aliments testés</p>
          <div className="public-share-kpi-main">
            <strong>
              {overview.introducedCount}/{overview.totalFoods}
            </strong>
            <span>{formatPercent(overview.introducedPercent)} du parcours découvert</span>
          </div>
        </article>

        <PublicSharePreferenceChart
          childLabel={childFirstName?.trim() || "bébé"}
          preferenceCounts={overview.completedPreferenceCounts}
        />
      </section>

      <PublicShareCategoryChart
        categoryDiscoveryCounts={overview.categoryDiscoveryCounts}
        toneByCategory={toneByCategory}
      />

      <PublicShareCumulativeChartLive
        initialCumulativeTastings={overview.cumulativeTastings}
        tastingDates={tastingDates}
        totalTastings={overview.totalTastings}
        serverTodayIso={serverTodayIso}
      />

      <PublicShareTimelinePanel
        timelineEntries={timelineEntries}
        finalPreferenceByFoodId={finalPreferenceByFoodId}
        toneByCategory={toneByCategory}
        childFirstName={childFirstName}
      />

      <footer className="public-share-footer">
        <div>
          <p>Ce lien partage le suivi en direct, sans connexion ni modification possible.</p>
          {expiresAtLabel ? <p>Valide jusqu&apos;au {expiresAtLabel}.</p> : null}
        </div>

        <a href="/login" className="share-public-primary-link">
          Ouvrir Grrrignote
        </a>
      </footer>
    </section>
  );
}
