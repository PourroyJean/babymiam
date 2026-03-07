"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentIsoDate } from "@/lib/date-utils";
import { buildPublicShareCumulativeTastings } from "@/lib/dashboard-read-model";
import type { PublicShareCumulativeTastingsPoint } from "@/lib/types";
import { formatDate } from "@/lib/ui-utils";

type PublicShareCumulativeChartLiveProps = {
  initialCumulativeTastings: PublicShareCumulativeTastingsPoint[];
  tastingDates: string[];
  totalTastings: number;
  serverTodayIso: string;
};

const CHART_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short"
});

function formatChartDate(value: string) {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return formatDate(value);
  return CHART_DATE_FORMATTER.format(parsed);
}

function formatTastingsLabel(value: number) {
  return `${value} dégustation${value === 1 ? "" : "s"}`;
}

function buildSampledIndexes(length: number, targetCount: number) {
  if (length <= 0) return [];
  if (length <= targetCount) return Array.from({ length }, (_, index) => index);

  const lastIndex = length - 1;
  const step = lastIndex / Math.max(1, targetCount - 1);
  const indexes = new Set<number>([0, lastIndex]);

  for (let index = 1; index < targetCount - 1; index += 1) {
    indexes.add(Math.round(step * index));
  }

  return [...indexes].sort((a, b) => a - b);
}

function buildStepChartPath(points: PublicShareCumulativeTastingsPoint[]) {
  if (points.length === 0) {
    return {
      path: "",
      pointPositions: [] as Array<PublicShareCumulativeTastingsPoint & { x: number; y: number }>,
      ticksX: [] as number[],
      ticksY: [0]
    };
  }

  const width = 700;
  const height = 270;
  const paddingLeft = 34;
  const paddingRight = 18;
  const paddingTop = 16;
  const paddingBottom = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxY = Math.max(1, points[points.length - 1]?.totalTastings || 0);
  const pointPositions = points.map((point, index) => {
    const x =
      points.length === 1 ? paddingLeft : paddingLeft + (index / (points.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (point.totalTastings / maxY) * chartHeight;

    return {
      ...point,
      x,
      y
    };
  });

  let path = `M ${pointPositions[0].x} ${pointPositions[0].y}`;

  for (let index = 1; index < pointPositions.length; index += 1) {
    const point = pointPositions[index];
    path += ` H ${point.x} V ${point.y}`;
  }

  const tickCount = maxY <= 3 ? maxY + 1 : 4;
  const ticksY = Array.from({ length: tickCount }, (_, index) => {
    if (tickCount === 1) return maxY;
    return Math.round((maxY / (tickCount - 1)) * index);
  });

  return {
    path,
    pointPositions,
    ticksX: buildSampledIndexes(points.length, 5),
    ticksY: [...new Set(ticksY)]
  };
}

function PublicShareCumulativeChart({
  cumulativeTastings,
  totalTastings
}: {
  cumulativeTastings: PublicShareCumulativeTastingsPoint[];
  totalTastings: number;
}) {
  const chart = buildStepChartPath(cumulativeTastings);
  const firstDate = cumulativeTastings[0]?.date ?? null;
  const lastDate = cumulativeTastings[cumulativeTastings.length - 1]?.date ?? null;
  const lastPoint = chart.pointPositions[chart.pointPositions.length - 1] ?? null;

  return (
    <section className="public-share-panel public-share-panel-chart" aria-labelledby="public-share-evolution-title">
      <header className="public-share-section-head public-share-section-head-wide">
        <div>
          <p className="public-share-section-kicker">Évolution</p>
          <h2 id="public-share-evolution-title">Évolution des dégustations</h2>
        </div>
        {totalTastings > 0 && firstDate && lastDate ? (
          <p className="public-share-chart-summary">
            {formatTastingsLabel(totalTastings)} cumulée{totalTastings === 1 ? "" : "s"} entre le {formatDate(firstDate)} et le{" "}
            {formatDate(lastDate)}.
          </p>
        ) : null}
      </header>

      {cumulativeTastings.length === 0 ? (
        <p className="public-share-chart-empty">La courbe apparaîtra dès la première dégustation.</p>
      ) : (
        <div className="public-share-line-chart">
          <svg
            viewBox="0 0 700 270"
            role="img"
            aria-label={`Courbe cumulative des dégustations, total final ${totalTastings}.`}
          >
            {chart.ticksY.map((tickValue) => {
              const maxY = Math.max(1, lastPoint?.totalTastings || 0);
              const y = 16 + (224 - (tickValue / maxY) * 224);
              return (
                <g key={tickValue}>
                  <line x1="34" y1={y} x2="682" y2={y} className="public-share-line-grid" />
                  <text x="26" y={y + 4} className="public-share-line-y-label">
                    {tickValue}
                  </text>
                </g>
              );
            })}

            {chart.ticksX.map((pointIndex) => {
              const point = chart.pointPositions[pointIndex];
              if (!point) return null;

              return (
                <g key={point.date}>
                  <line x1={point.x} y1="16" x2={point.x} y2="240" className="public-share-line-grid public-share-line-grid-vertical" />
                  <text x={point.x} y="262" textAnchor="middle" className="public-share-line-x-label">
                    {formatChartDate(point.date)}
                  </text>
                </g>
              );
            })}

            <path d={chart.path} className="public-share-line-path" />
            {lastPoint ? <circle cx={lastPoint.x} cy={lastPoint.y} r="6" className="public-share-line-dot" /> : null}
          </svg>
        </div>
      )}
    </section>
  );
}

export function PublicShareCumulativeChartLive({
  initialCumulativeTastings,
  tastingDates,
  totalTastings,
  serverTodayIso
}: PublicShareCumulativeChartLiveProps) {
  const [viewerTodayIso, setViewerTodayIso] = useState(serverTodayIso);

  useEffect(() => {
    const clientTodayIso = getCurrentIsoDate();
    if (clientTodayIso !== serverTodayIso) {
      setViewerTodayIso(clientTodayIso);
    }
  }, [serverTodayIso]);

  const cumulativeTastings = useMemo(
    () =>
      viewerTodayIso === serverTodayIso
        ? initialCumulativeTastings
        : buildPublicShareCumulativeTastings(tastingDates, viewerTodayIso),
    [initialCumulativeTastings, serverTodayIso, tastingDates, viewerTodayIso]
  );

  return <PublicShareCumulativeChart cumulativeTastings={cumulativeTastings} totalTastings={totalTastings} />;
}
