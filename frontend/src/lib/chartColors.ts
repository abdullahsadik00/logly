/**
 * Chart color palette resolved from the CSS design tokens (src/styles/tokens.css).
 *
 * Charting libraries (Recharts) need real color strings for SVG stroke/fill
 * attributes — Tailwind semantic classes and `var(--token)` attribute values
 * don't apply there. Reading the tokens at runtime keeps charts on-palette
 * without hardcoding hex in components, so tokens.css stays the single source
 * of truth (per DESIGN.md's golden rule).
 */

/** Resolve an `--c-*` token triplet (e.g. "22 201 138") to an `rgb()` string. */
function readToken(name: string): string {
  const triplet = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  // Fallback to fg-muted's value if the variable can't be resolved.
  return triplet ? `rgb(${triplet})` : 'rgb(107 114 124)';
}

export interface ChartPalette {
  /** Categorical series colors, in draw order. */
  series: [string, string];
  /** Cartesian grid lines. */
  grid: string;
  /** Axis tick labels. */
  axis: string;
  /** Legend text. */
  legend: string;
  /** Stroke ring around an active data point (matches the card surface). */
  dotStroke: string;
}

/** Build the chart palette from the currently-active design tokens. */
export function getChartPalette(): ChartPalette {
  return {
    series: [readToken('--c-info'), readToken('--c-accent')],
    grid: readToken('--c-border-strong'),
    axis: readToken('--c-fg-muted'),
    legend: readToken('--c-fg-secondary'),
    dotStroke: readToken('--c-surface'),
  };
}
