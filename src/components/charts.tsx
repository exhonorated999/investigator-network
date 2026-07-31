/**
 * Dependency-free SVG chart primitives for the admin analytics dashboard.
 *
 * Server-component safe — no "use client", no hooks, no event handlers, no
 * browser APIs. Every component renders pure SVG from props and can be used
 * inside async server components.
 *
 * Styling uses only Tailwind utility classes + the project's CSS custom
 * properties (mapped via `@theme inline` in globals.css). Colors resolve to
 * the same variables the rest of the UI uses: --accent, --accent-bright,
 * --muted, --border, --success, --gold, --danger.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Format a number for axis/label display — integers pass through, floats get 1 decimal. */
function formatValue(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

// ---------------------------------------------------------------------------
// Sparkline — filled area + line trend
// ---------------------------------------------------------------------------

export interface SparklineProps {
  /** Y values, oldest → newest. */
  points: number[];
  /** Accessible description of the series; also used for aria-label. */
  label?: string;
  /** SVG height in px (width is responsive). @default 48 */
  height?: number;
  className?: string;
}

/**
 * A compact filled-area + line trend chart. Handles empty arrays, a single
 * point, and all-zero values without producing NaN by guarding the range.
 */
export function Sparkline({
  points,
  label,
  height = 48,
  className,
}: SparklineProps) {
  const W = 200; // logical viewBox width; scales via w-full
  const H = height;
  const pad = 2; // breathing room so strokes aren't clipped

  const count = points.length;

  // --- Edge cases ---------------------------------------------------------
  if (count === 0) {
    return (
      <svg
        role="img"
        aria-label={label ?? "Trend chart — no data"}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={`w-full ${className ?? ""}`}
        style={{ height: H }}
      >
        <line
          x1={0}
          y1={H - pad}
          x2={W}
          y2={H - pad}
          className="stroke-border"
          strokeWidth={1}
        />
      </svg>
    );
  }

  // Range — guard against divide-by-zero when all values are equal.
  const rawMin = Math.min(...points);
  const rawMax = Math.max(...points);
  const range = rawMax - rawMin;
  // If range is 0 (flat line, incl. all-zero), use 1 so we don't divide by 0.
  const span = range === 0 ? 1 : range;

  const innerH = H - pad * 2;

  // Map a value to an SVG Y coordinate (inverted: higher value = lower Y).
  const toY = (v: number): number => pad + innerH - ((v - rawMin) / span) * innerH;
  const toX = (i: number): number =>
    count === 1 ? W / 2 : (i / (count - 1)) * W;

  const coords = points.map((v, i) => [toX(i), toY(v)] as const);

  // Line path
  const linePath = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  // Filled area path — close down to the baseline.
  const areaPath =
    count === 1
      ? // Single point: draw a thin vertical bar instead of a degenerate area.
        `M${(W / 2 - 0.5).toFixed(2)} ${pad} L${(W / 2 + 0.5).toFixed(2)} ${pad} L${(W / 2 + 0.5).toFixed(2)} ${H - pad} L${(W / 2 - 0.5).toFixed(2)} ${H - pad} Z`
      : `${linePath} L${W} ${H - pad} L0 ${H - pad} Z`;

  const aria = label ?? `Trend chart with ${count} data points`;

  return (
    <svg
      role="img"
      aria-label={aria}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`w-full ${className ?? ""}`}
      style={{ height: H }}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#spark-fill)" />
      <path
        d={linePath}
        fill="none"
        className="stroke-accent-bright"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// BarChart — vertical bars for a labeled series
// ---------------------------------------------------------------------------

export interface BarChartProps {
  data: { label: string; value: number }[];
  /** SVG height in px (width is responsive). @default 180 */
  height?: number;
  className?: string;
  /** Visually distinguish the last bar (e.g. the current in-progress period). */
  highlightLast?: boolean;
}

/**
 * Vertical bar chart with value labels and x-axis labels in mono type.
 * Handles empty data and all-zero values by rendering a flat baseline.
 */
export function BarChart({
  data,
  height = 180,
  className,
  highlightLast = false,
}: BarChartProps) {
  const W = 320; // logical viewBox width
  const H = height;
  const padTop = 18; // room for value labels
  const padBottom = 22; // room for x-axis labels
  const padLeft = 4;
  const padRight = 4;

  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const count = data.length;

  // --- Empty state --------------------------------------------------------
  if (count === 0) {
    return (
      <svg
        role="img"
        aria-label="Bar chart — no data"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className={`w-full ${className ?? ""}`}
        style={{ height: H }}
      >
        <line
          x1={padLeft}
          y1={H - padBottom}
          x2={W - padRight}
          y2={H - padBottom}
          className="stroke-border"
          strokeWidth={1}
        />
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          className="fill-muted font-mono"
          fontSize={10}
        >
          NO DATA
        </text>
      </svg>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 0);
  // Guard divide-by-zero: if all values are 0, bars render as a flat baseline.
  const safeMax = maxVal === 0 ? 1 : maxVal;

  const slotW = innerW / count;
  const barW = Math.min(slotW * 0.6, 36); // cap bar width for readability

  const baselineY = padTop + innerH;

  const aria = `Bar chart: ${data
    .map((d) => `${d.label} ${formatValue(d.value)}`)
    .join(", ")}`;

  return (
    <svg
      role="img"
      aria-label={aria}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className={`w-full ${className ?? ""}`}
      style={{ height: H }}
    >
      {/* Baseline */}
      <line
        x1={padLeft}
        y1={baselineY}
        x2={W - padRight}
        y2={baselineY}
        className="stroke-border"
        strokeWidth={1}
      />

      {data.map((d, i) => {
        const barH = (d.value / safeMax) * innerH;
        const x = padLeft + i * slotW + (slotW - barW) / 2;
        const y = baselineY - barH;
        const isLast = i === count - 1;
        const highlighted = highlightLast && isLast;

        return (
          <g key={`${d.label}-${i}`}>
            {/* Bar */}
            <rect
              x={x.toFixed(2)}
              y={y.toFixed(2)}
              width={barW.toFixed(2)}
              height={Math.max(barH, 0).toFixed(2)}
              className={
                highlighted
                  ? "fill-gold"
                  : d.value === 0
                    ? "fill-border"
                    : "fill-accent"
              }
              rx={1}
            />
            {/* Value label */}
            <text
              x={(x + barW / 2).toFixed(2)}
              y={(y - 4).toFixed(2)}
              textAnchor="middle"
              className={`font-mono ${highlighted ? "fill-gold" : "fill-muted"}`}
              fontSize={9}
            >
              {formatValue(d.value)}
            </text>
            {/* X-axis label */}
            <text
              x={(x + barW / 2).toFixed(2)}
              y={(H - 6).toFixed(2)}
              textAnchor="middle"
              className="fill-muted font-mono"
              fontSize={9}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// HBar — single horizontal proportion bar
// ---------------------------------------------------------------------------

export interface HBarProps {
  /** Current value. */
  value: number;
  /** Maximum value defining the full width. Must be > 0. */
  max: number;
  /** Label shown to the left of (or above) the bar. */
  label: string;
  className?: string;
}

/**
 * A single horizontal proportion bar for "N users in this course" rows.
 * Guards `max <= 0` by rendering an empty track.
 */
export function HBar({ value, max, label, className }: HBarProps) {
  const safe = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(value / safe, 1));
  const pctStr = `${(pct * 100).toFixed(0)}%`;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[13px] text-foreground">{label}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted">
          {formatValue(value)}
          <span className="text-muted/60"> / {formatValue(max)}</span>
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden border border-border bg-[rgba(10,12,17,0.6)]"
        role="img"
        aria-label={`${label}: ${formatValue(value)} of ${formatValue(max)} (${pctStr})`}
      >
        <div
          className="h-full bg-accent-bright"
          style={{ width: pctStr }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut — single-value ring for percentages
// ---------------------------------------------------------------------------

export interface DonutProps {
  /** Percentage value 0–100. Clamped to range; NaN treated as 0. */
  value: number;
  /** Label shown below the percentage. */
  label: string;
  /** Diameter in px. @default 120 */
  size?: number;
}

/**
 * A single-value ring chart for percentages (e.g. pass rate). Renders the
 * percentage in the center. Guards NaN/out-of-range by clamping to 0–100.
 */
export function Donut({ value, label, size = 120 }: DonutProps) {
  const clamped = Number.isNaN(value) ? 0 : Math.max(0, Math.min(value, 100));
  const pct = Math.round(clamped);

  const stroke = 8; // ring thickness
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;

  // Color shifts by threshold: success ≥ 75, gold 50–74, danger < 50.
  const ringClass =
    clamped >= 75 ? "stroke-success" : clamped >= 50 ? "stroke-gold" : "stroke-danger";

  return (
    <div
      className="inline-flex flex-col items-center"
      role="img"
      aria-label={`${label}: ${pct}%`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ width: size, height: size }}
        >
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className="stroke-border"
            strokeWidth={stroke}
          />
          {/* Value arc — rotate -90° so it starts at the top. */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className={ringClass}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash.toFixed(2)} ${circumference.toFixed(2)}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-semibold text-foreground">
            {pct}
            <span className="text-sm text-muted">%</span>
          </span>
        </div>
      </div>
      <span className="eyebrow eyebrow-muted mt-2 text-[9px]">{label}</span>
    </div>
  );
}
