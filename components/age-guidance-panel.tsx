"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgeGuidanceSnapshot, AgeGuidanceStageKey } from "@/lib/age-guidance";

type AgeGuidancePanelProps = {
  guidance: AgeGuidanceSnapshot;
};

function getPriorityClassName(tone: AgeGuidanceSnapshot["stages"][number]["priorities"][number]["tone"]) {
  if (tone === "action") return "age-guidance-priority age-guidance-priority-action";
  if (tone === "progress") return "age-guidance-priority age-guidance-priority-progress";
  return "age-guidance-priority age-guidance-priority-attention";
}

export function AgeGuidancePanel({ guidance }: AgeGuidancePanelProps) {
  const [selectedStageKey, setSelectedStageKey] = useState<AgeGuidanceStageKey>(guidance.defaultStageKey);

  useEffect(() => {
    setSelectedStageKey(guidance.defaultStageKey);
  }, [guidance.defaultStageKey]);

  const stageByKey = useMemo(
    () => new Map(guidance.stages.map((stage) => [stage.key, stage] as const)),
    [guidance.stages]
  );
  const selectedStage = stageByKey.get(selectedStageKey) ?? guidance.stages[0];
  const selectedStageIndex = guidance.stages.findIndex((stage) => stage.key === selectedStage.key);
  const currentStageIndex =
    guidance.currentStageKey === null ? -1 : guidance.stages.findIndex((stage) => stage.key === guidance.currentStageKey);
  const hasSummary = selectedStage.summary.trim().length > 0;
  const hasPriorities = selectedStage.priorities.length > 0;
  const asideCards = selectedStage.asideCards ?? [];
  const hasAsideCards = asideCards.length > 0;
  const hasReminders = selectedStage.reminders.length > 0;

  let stageContextLabel = "Aperçu guide";

  if (guidance.currentStageKey !== null && selectedStage.key === guidance.currentStageKey) {
    stageContextLabel = "Bloc du moment";
  } else if (guidance.currentStageKey !== null && selectedStageIndex > currentStageIndex) {
    stageContextLabel = "À venir";
  } else if (guidance.currentStageKey !== null && selectedStageIndex < currentStageIndex) {
    stageContextLabel = "Repère précédent";
  }

  return (
    <section className="age-guidance-panel" aria-labelledby="age-guidance-title">
      <div className="age-guidance-hero">
        <div className="age-guidance-title-block">
          <h2 id="age-guidance-title">Le Guide</h2>
        </div>
      </div>

      <section className="age-guidance-stage-switcher" aria-label="Navigation entre les blocs d'âge">
        <ul className="age-guidance-stage-tabs">
          {guidance.stages.map((stage) => {
            const isSelected = stage.key === selectedStage.key;
            const isCurrent = guidance.currentStageKey !== null && stage.key === guidance.currentStageKey;

            return (
              <li key={stage.key}>
                <button
                  type="button"
                  className={`age-guidance-stage-tab${isSelected ? " is-selected" : ""}${isCurrent ? " is-current" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedStageKey(stage.key)}
                >
                  <span className="age-guidance-stage-tab-label">{stage.tabLabel}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="age-guidance-grid">
        <section className="age-guidance-column" aria-labelledby="age-guidance-priorities-title">
          <div className="age-guidance-column-head">
            <p className="age-guidance-column-kicker">{stageContextLabel}</p>
            <h3 id="age-guidance-priorities-title">{selectedStage.stageLabel}</h3>
            {hasSummary ? <p className="age-guidance-summary">{selectedStage.summary}</p> : null}
          </div>

          {hasPriorities ? (
            <ul className="age-guidance-priority-list">
              {selectedStage.priorities.map((priority) => (
                <li key={priority.id} className={getPriorityClassName(priority.tone)}>
                  <p className="age-guidance-priority-badge">{priority.badge}</p>
                  <h4>{priority.title}</h4>
                  <p>{priority.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="age-guidance-empty-state">
              <h4>Bloc en préparation</h4>
              <p>Les repères détaillés de cette tranche d&apos;âge seront ajoutés ici.</p>
            </div>
          )}
        </section>

        <section className="age-guidance-column" aria-labelledby="age-guidance-reminders-title">
          <div className="age-guidance-column-head">
            <p className="age-guidance-column-kicker">{selectedStage.asideKicker ?? "Dans le guide"}</p>
            <div className="age-guidance-column-head-row">
              <h3 id="age-guidance-reminders-title">{selectedStage.asideTitle ?? "À garder en tête"}</h3>
              {selectedStage.textureLabel ? (
                <div className="age-guidance-stage-meta" aria-label="Repère texture">
                  <span className="age-guidance-stage-meta-pill">{selectedStage.textureLabel}</span>
                </div>
              ) : null}
            </div>
          </div>

          {hasAsideCards ? (
            <ul className="age-guidance-side-list">
              {asideCards.map((card) => (
                <li key={card.id} className={getPriorityClassName(card.tone)}>
                  <p className="age-guidance-priority-badge">{card.badge}</p>
                  <h4>{card.title}</h4>
                  <p>{card.detail}</p>
                  {card.bullets && card.bullets.length > 0 ? (
                    <ul className="age-guidance-card-bullets">
                      {card.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : hasReminders ? (
            <ul className="age-guidance-reminder-list">
              {selectedStage.reminders.map((reminder) => (
                <li key={reminder}>{reminder}</li>
              ))}
            </ul>
          ) : (
            <div className="age-guidance-empty-state age-guidance-empty-state-muted">
              <h4>Rappels à venir</h4>
              <p>Cette colonne accueillera les points de vigilance et les repères transverses.</p>
            </div>
          )}
          <p className="age-guidance-footer">{guidance.footer}</p>
        </section>
      </div>
    </section>
  );
}
