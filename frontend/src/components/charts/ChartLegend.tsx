import type { ReactNode } from "react";

export type SwatchType = "area" | "solid" | "dashed" | "dotted";

export interface LegendEntry {
    id: string;
    label: ReactNode;
    swatch: SwatchType;
    color: string;
}

interface ChartLegendProps {
    entries: LegendEntry[];
}

export default function ChartLegend({ entries }: ChartLegendProps) {
    if (entries.length === 0) return null;
    return (
        <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            justifyContent: "center",
            marginBottom: "8px",
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: "1rem",
            color: "#888884",
        }}>
            {entries.map(e => (
                <span key={e.id} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    {e.swatch === "area" ? (
                        <span style={{
                            display: "inline-block",
                            width: "12px",
                            height: "12px",
                            backgroundColor: e.color,
                            borderRadius: "2px",
                            flexShrink: 0,
                            opacity: 0.85,
                        }} />
                    ) : (
                        <span style={{
                            display: "inline-block",
                            width: "16px",
                            height: "0",
                            borderTop: `3px ${e.swatch} ${e.color}`,
                            flexShrink: 0,
                        }} />
                    )}
                    {e.label}
                </span>
            ))}
        </div>
    );
}
