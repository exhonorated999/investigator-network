/**
 * Active-users line chart — hand-built inline SVG.
 *
 * Server-component safe — no "use client", no hooks, no event handlers.
 * Renders a responsive polyline through daily active-user counts with
 * gridlines, axis labels, and a peak-value callout.
 *
 * Styling uses the project's CSS custom properties via Tailwind utility
 * classes: stroke-accent-bright (cyan line), stroke-border / fill-muted
 * (axes & labels), matching the sibling chart primitives in charts.tsx.
 */

export interface ActiveUsersChartProps {
  data: { day: number; count: number }[];
}

/**
 * Renders a line chart of daily active users. Every day gets a point on the
 * line; x-axis labels are shown roughly every 5 days plus the last day to
 * avoid crowding. Handles all-zero and empty data gracefully.
 */
export function ActiveUsersChart({ data }: ActiveUsersChartProps) {
  const W = 700;
  const H = 220;
  const padTop = 24;
  const padBottom = 28;
  const padLeft = 36;
  const padRight = 16;

  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const count = data.length;

  // --- Empty state --------------------------------------------------------
  if (count === 0) {
    return (
      <svg
        role="img"
        aria-label="Active users this month — no data"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
      >
        <line
          x1={padLeft}
          y1={padTop + innerH}
          x2={W - padRight}
          y2={padTop + innerH}
          className="stroke-border"
          strokeWidth={1}
        />
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          className="fill-muted font-mono"
          fontSize={11}
        >
          NO DATA
        </text>
      </svg>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.count), 0);
  // Guard divide-by-zero: if all values are 0, use 1 so the line sits on the baseline.
  const safeMax = maxVal === 0 ? 1 : maxVal;

  const baselineY = padTop + innerH;

  // Map a data index to an SVG X coordinate.
  const toX = (i: number): number =>
    count === 1 ? padLeft + innerW / 2 : padLeft + (i / (count - 1)) * innerW;

  // Map a count value to an SVG Y coordinate (inverted).
  const toY = (v: number): number =>
    padTop + innerH - (v / safeMax) * innerH;

  // Polyline points string.
  const points = data
    .map((d, i) => `${toX(i).toFixed(2)},${toY(d.count).toFixed(2)}`)
    .join(" ");

  // X-axis labels: show day 1, then every 5th, plus the last day.
  const labelDays = new Set<number>();
  labelDays.add(1);
  for (const d of data) {
    if (d.day % 5 === 0) labelDays.add(d.day);
  }
  labelDays.add(data[data.length - 1].day);

  // Gridlines: 2 horizontal lines at 1/3 and 2/3 of the range.
  const gridY1 = padTop + innerH * (1 / 3);
  const gridY2 = padTop + innerH * (2 / 3);

  const aria = `Daily active users line chart: ${data
    .map((d) => `day ${d.day} ${d.count}`)
    .join(", ")}`;

  return (
    <svg
      role="img"
      aria-label={aria}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto"
    >
      {/* Gridlines */}
      <line
        x1={padLeft}
        y1={gridY1}
        x2={W - padRight}
        y2={gridY1}
        className="stroke-border"
        strokeWidth={1}
        strokeDasharray="2 4"
        opacity={0.5}
      />
      <line
        x1={padLeft}
        y1={gridY2}
        x2={W - padRight}
        y2={gridY2}
        className="stroke-border"
        strokeWidth={1}
        strokeDasharray="2 4"
        opacity={0.5}
      />

      {/* Baseline (x-axis) */}
      <line
        x1={padLeft}
        y1={baselineY}
        x2={W - padRight}
        y2={baselineY}
        className="stroke-border"
        strokeWidth={1}
      />

      {/* Y-axis max label */}
      <text
        x={padLeft - 6}
        y={padTop + 4}
        textAnchor="end"
        className="fill-muted font-mono"
        fontSize={10}
      >
        {maxVal}
      </text>
      <text
        x={padLeft - 6}
        y={baselineY + 3}
        textAnchor="end"
        className="fill-muted font-mono"
        fontSize={10}
      >
        0
      </text>

      {/* Peak callout */}
      {maxVal > 0 && (
        <text
          x={W - padRight}
          y={padTop - 8}
          textAnchor="end"
          className="fill-accent-bright font-mono"
          fontSize={10}
        >
          peak {maxVal}
        </text>
      )}

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        className="stroke-accent-bright"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Dots at each data point */}
      {data.map((d, i) => (
        <circle
          key={d.day}
          cx={toX(i).toFixed(2)}
          cy={toY(d.count).toFixed(2)}
          r={d.count > 0 ? 2.5 : 1.5}
          className={d.count > 0 ? "fill-accent-bright" : "fill-border"}
        />
      ))}

      {/* X-axis labels */}
      {data.map((d, i) =>
        labelDays.has(d.day) ? (
          <text
            key={`label-${d.day}`}
            x={toX(i).toFixed(2)}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted font-mono"
            fontSize={10}
          >
            {d.day}
          </text>
        ) : null
      )}
    </svg>
  );
}
