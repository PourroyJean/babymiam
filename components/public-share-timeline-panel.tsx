import type { FinalPreferenceValue, FoodTimelineEntry } from "@/lib/types";
import { FoodTimelineFeed } from "@/components/food-timeline-feed";

type PublicShareTimelinePanelProps = {
  timelineEntries: FoodTimelineEntry[];
  finalPreferenceByFoodId: Record<number, FinalPreferenceValue>;
  toneByCategory: Record<string, string>;
  childFirstName?: string | null;
};

export function PublicShareTimelinePanel({
  timelineEntries,
  finalPreferenceByFoodId,
  toneByCategory,
  childFirstName
}: PublicShareTimelinePanelProps) {
  const normalizedFirstName = childFirstName?.trim() || "";
  const timelineTitle = normalizedFirstName ? `Carnet de bord de ${normalizedFirstName}` : "Carnet de bord";

  return (
    <section className="public-share-timeline-panel" aria-labelledby="public-share-timeline-title">
      <header className="public-share-section-head public-share-timeline-head">
        <div>
          <p className="public-share-section-kicker">Suivi récent</p>
          <h2 id="public-share-timeline-title">{timelineTitle}</h2>
        </div>
      </header>

      <div className="public-share-timeline-body">
        <FoodTimelineFeed
          timelineEntries={timelineEntries}
          finalPreferenceByFoodId={finalPreferenceByFoodId}
          toneByCategory={toneByCategory}
          emptyMessage="Aucune dégustation enregistrée pour le moment."
        />
      </div>
    </section>
  );
}
