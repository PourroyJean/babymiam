import { PublicShareCategoryChart } from "@/components/public-share-category-chart";
import type {
  FinalPreferenceValue,
  FoodTimelineEntry,
  PublicShareCategoryFoodList,
  PublicShareOverview,
  PublicSharePreferenceFoodLists
} from "@/lib/types";
import { PublicShareCumulativeChartLive } from "@/components/public-share-cumulative-chart-live";
import { PublicSharePreferenceChart } from "@/components/public-share-preference-chart";
import { PublicShareTimelinePanel } from "@/components/public-share-timeline-panel";

type PublicShareDashboardProps = {
  overview: PublicShareOverview;
  preferenceFoodLists: PublicSharePreferenceFoodLists;
  categoryFoodLists: PublicShareCategoryFoodList[];
  timelineEntries: FoodTimelineEntry[];
  tastingDates: string[];
  finalPreferenceByFoodId: Record<number, FinalPreferenceValue>;
  toneByCategory: Record<string, string>;
  childFirstName?: string | null;
  expiresAtLabel: string | null;
  serverTodayIso: string;
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function PublicShareDashboard({
  overview,
  preferenceFoodLists,
  categoryFoodLists,
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
          foodLists={preferenceFoodLists}
        />
      </section>

      <PublicShareCategoryChart
        categoryDiscoveryCounts={overview.categoryDiscoveryCounts}
        categoryFoodLists={categoryFoodLists}
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
