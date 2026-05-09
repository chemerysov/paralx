// d3 margin convention — left is widest to accommodate y-axis tick labels
export const MARGIN = { top: 20, right: 20, bottom: 36, left: 56 };
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
