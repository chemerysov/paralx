import type { ReactNode } from "react";
import Katex from "../Katex";

export interface SeriesLink {
    id: string;
}

export interface SeriesLegendEntry {
    id: string;
    label: string;
    labelHover?: string;
    metaTitle: string;
}

interface ChartFooterProps {
    cite?: ReactNode;
    units?: string | null;
    seasonalAdj?: string | null;
    frequency?: string | null;
    lastUpdated?: string | null;
    // single-series: pass series
    series?: string;
    // multi-series: pass seriesLinks
    seriesLinks?: SeriesLink[];
    // bar chart only: extended legend pairing katex label with pulled meta title
    seriesLegend?: SeriesLegendEntry[];
}

export default function ChartFooter({
    cite,
    units,
    seasonalAdj,
    frequency,
    lastUpdated,
    series,
    seriesLinks,
    seriesLegend,
}: ChartFooterProps) {
    const footerStyle: React.CSSProperties = {
        display: "block",
        fontSize: "0.85rem",
        color: "#888884",
        fontStyle: "normal",
        fontFamily: "ui-serif, Georgia, serif",
        marginTop: "8px",
        marginBottom: "0",
    };

    return (
        <div style={footerStyle}>
            {cite ?? (
                <>
                    {(units || seasonalAdj || frequency) && (
                        <span style={{ display: "block" }}>
                            Units: {[units, seasonalAdj, frequency].filter(Boolean).join(", ")}
                        </span>
                    )}
                    <span style={{ display: "block" }}>
                        Source: Federal Reserve Bank of St. Louis,{" "}
                        {series && (
                            <a
                                href={`https://fred.stlouisfed.org/series/${series}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#888884" }}
                            >
                                {series}
                            </a>
                        )}
                        {seriesLinks && seriesLinks.map((s, i) => (
                            <span key={s.id}>
                                {i > 0 && ", "}
                                <a
                                    href={`https://fred.stlouisfed.org/series/${s.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: "#888884" }}
                                >
                                    {s.id}
                                </a>
                            </span>
                        ))}
                    </span>
                    {lastUpdated && (
                        <span style={{ display: "block" }}>
                            Retrieved: {lastUpdated}
                        </span>
                    )}
                    {seriesLegend && seriesLegend.length > 0 && (
                        <span style={{ display: "block", marginTop: "6px" }}>
                            {seriesLegend.map(entry => (
                                <span key={entry.id} style={{ display: "block" }}>
                                    {entry.labelHover
                                        ? <Katex formula={entry.labelHover} display={false} />
                                        : entry.label
                                    }
                                    {": "}
                                    {entry.metaTitle}
                                </span>
                            ))}
                        </span>
                    )}
                </>
            )}
        </div>
    );
}
