// d3 margin convention — left is widest to accommodate y-axis tick labels
export const MARGIN = { top: 20, right: 20, bottom: 36, left: 56 };

// ── chart color palette ───────────────────────────────────────────────────────
// Derived from Okabe-Ito: distinguishable under deuteranopia, protanopia, and
// tritanopia. Muted to suit the warm off-white background.
export const CHART_PALETTE = [
    "#c8882e",  // amber
    "#5a9ab8",  // steel blue
    "#2e9070",  // teal
    "#9060a8",  // violet
    "#b85030",  // terracotta
    "#6a8a48",  // olive
    "#7868a8",  // slate
];
// neutral dark for totals, residuals, and single-series lines
export const CHART_TOTAL_COLOR = "#3a3a3a";

export const SWATCH_W = 10;
export const SWATCH_GAP = 5;
export const CSS_HEIGHT = 360;

export interface Observation {
    date: string;
    value: number;
}

export interface ParsedObservation {
    date: Date;
    value: number;
}

// yAbsMax: the magnitude of the largest value in the y domain,
// used to decide whether to compress the axis labels into "k" notation
export function formatAxisValue(v: number, yAbsMax: number): string {
    if (v === 0) return "0";
    if (yAbsMax >= 1000) return (v / 1000).toFixed(0) + "k";
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function formatHoverValue(v: number): string {
    if (v === 0) return "0";
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "k";
    return v.toFixed(1);
}

// ── tooltip geometry ──────────────────────────────────────────────────────────

export const TOOLTIP_PAD_X = 8;
export const TOOLTIP_PAD_Y = 6;
export const TOOLTIP_DATE_Y = 10;
export const TOOLTIP_LINE_H = 16;
export const TOOLTIP_FIRST_ROW_Y = 28; // DATE_Y + one row height

// Computes tooltip box position from hover x, plot width, and content size.
// textLeft is the x where text content begins; rect starts PAD_X to its left.
export function tooltipGeometry(hx: number, innerWidth: number, contentW: number, contentH: number) {
    const flipLeft = hx > innerWidth / 2;
    const rectW = contentW + TOOLTIP_PAD_X * 2;
    const rectH = contentH + TOOLTIP_PAD_Y * 2;
    const rectY = TOOLTIP_DATE_Y - TOOLTIP_PAD_Y;
    const textLeft = flipLeft
        ? hx - 10 - contentW - TOOLTIP_PAD_X
        : hx + 10 - TOOLTIP_PAD_X;
    return { flipLeft, rectX: textLeft, rectY, rectW, rectH, baseX: textLeft + TOOLTIP_PAD_X };
}

// ── x-tick computation ────────────────────────────────────────────────────────

export function computeXTicks(
    refData: { date: Date }[],
    innerWidth: number,
    xDomain: [Date, Date]
): Date[] {
    if (refData.length < 2) return [];
    const firstYear = refData[0].date.getFullYear();
    const lastYear = refData[refData.length - 1].date.getFullYear();
    const maxTicks = Math.max(1, Math.floor(innerWidth / 60));
    const rawStep = (lastYear - firstYear) / maxTicks;
    const niceSteps = [1, 2, 5, 10, 20, 25, 50];
    const interval = niceSteps.find(s => s >= rawStep) ?? 50;
    const [domainStart, domainEnd] = xDomain;
    const ticks: Date[] = [];
    for (let y = lastYear; y >= firstYear; y -= interval) {
        const t = new Date(y, 0, 1);
        if (t >= domainStart && t <= domainEnd) ticks.unshift(t);
    }
    return ticks;
}

// module-level canvas reused across all measureTextWidth calls to avoid
// creating a new element on every hover frame
let _canvas: HTMLCanvasElement | null = null;

// measures the rendered pixel width of a string at a given font size,
// using the same serif font family as the chart hover text.
// falls back to a rough character-count estimate during SSR.
export function measureTextWidth(text: string, fontSize: number): number {
    if (typeof document === "undefined") {
        return text.length * fontSize * 0.55;
    }
    if (!_canvas) _canvas = document.createElement("canvas");
    const ctx = _canvas.getContext("2d");
    if (!ctx) return text.length * fontSize * 0.55;
    ctx.font = `${fontSize}px ui-serif, Georgia, serif`;
    return ctx.measureText(text).width;
}
