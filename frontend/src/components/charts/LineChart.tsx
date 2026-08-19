import {
    useEffect,
    useState,
    type ReactNode,
} from "react";

import {
    scaleTime,
    scaleLinear,
    extent,
    line,
    bisector,
} from "d3";

import Katex from "../Katex";

import {
    MARGIN, CSS_HEIGHT,
    type Observation, type ParsedObservation,
    formatHoverValue, measureTextWidth, computeXTicks,
    TOOLTIP_LINE_H, TOOLTIP_FIRST_ROW_Y,
    tooltipGeometry,
    CHART_PALETTE, SWATCH_W, SWATCH_GAP,
} from "./chartShared";
import { useContainerWidth } from "./useContainerWidth";
import ChartFooter, { type SeriesLink, type SeriesLegendEntry } from "./ChartFooter";
import ChartTitle from "./ChartTitle";
import ChartLegend, { type LegendEntry } from "./ChartLegend";
import ChartPlaceholder from "./ChartPlaceholder";
import ChartAxes from "./ChartAxes";
import ChartTooltip from "./ChartTooltip";


export interface LineSeriesConfig {
    id: string;
    label?: string;      // KaTeX formula: legend, footer, and (single-series) title suffix
    labelHover?: string; // plain text: hover tooltip (falls back to label then id)
}

interface SeriesMeta {
    title?: string;
    units?: string;
    seasonalAdj?: string;
    frequency?: string;
    lastUpdated?: string;
}

interface LineChartProps {
    series: string | LineSeriesConfig | (string | LineSeriesConfig)[];
    title?: ReactNode;
    cite?: ReactNode;
}

export default function LineChart({ series, title, cite }: LineChartProps) {
    const seriesConfigs: LineSeriesConfig[] = (Array.isArray(series) ? series : [series])
        .map(s => typeof s === "string" ? { id: s } : s);
    const seriesIds = seriesConfigs.map(c => c.id);
    const isMulti = seriesIds.length > 1;
    const seriesKey = seriesIds.join(",");

    const [containerRef, width] = useContainerWidth();
    const [allData, setAllData] = useState<Record<string, ParsedObservation[]>>({});
    const [metaMap, setMetaMap] = useState<Record<string, SeriesMeta>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    function fetchMeta(id: string) {
        fetch(`/api/series/${id}/meta`)
            .then(res => res.ok ? res.json() : null)
            .then(meta => {
                if (!meta) return;
                setMetaMap(prev => ({
                    ...prev,
                    [id]: {
                        title: meta.title,
                        units: meta.units,
                        seasonalAdj: meta.seasonal_adjustment,
                        frequency: meta.frequency,
                        lastUpdated: meta.last_fetched_at
                            ? new Date(meta.last_fetched_at).toLocaleString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "UTC",
                                timeZoneName: "short",
                            })
                            : undefined,
                    },
                }));
            })
            .catch(() => {});
    }

    useEffect(() => {
        let cancelled = false;
        // No reset of the state above before fetching. Every chart on the
        // site is an Astro island whose series list is written into the page
        // at build time, so this dependency never changes and the effect runs
        // exactly once, on mount, when the state is already at these values.
        // If a chart ever becomes switchable at runtime, the React answer is
        // to give it a `key` so it remounts, not to clear the state here.

        const ids = seriesKey.split(",");
        let loaded = 0;

        ids.forEach(id => {
            fetchMeta(id);
            fetch(`/api/series/${id}`)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then((raw: Observation[]) => {
                    if (cancelled) return;
                    const parsed = raw.map(d => ({
                        // T00:00:00 forces local-time parsing, avoiding date-off-by-one west of UTC
                        date: new Date(d.date + "T00:00:00"),
                        value: d.value,
                    }));
                    setAllData(prev => ({ ...prev, [id]: parsed }));
                    loaded++;
                    if (loaded === ids.length) {
                        setLoading(false);
                        ids.forEach(fetchMeta);
                    }
                })
                .catch(() => {
                    if (!cancelled) {
                        setError("Failed to load data.");
                        setLoading(false);
                    }
                });
        });

        return () => { cancelled = true; };
    }, [seriesKey]);

    const primaryData = allData[seriesIds[0]] ?? [];
    const allPoints = Object.values(allData).flat();

    // x-domain starts at the latest "first non-zero observation" across all series
    const effectiveStart = (() => {
        if (Object.keys(allData).length < seriesIds.length) return null;
        const firstDates = seriesIds.map(id => {
            const first = (allData[id] ?? []).find(p => p.value !== 0);
            return first ? first.date : null;
        });
        if (firstDates.some(d => d === null)) return null;
        return new Date(Math.max(...(firstDates as Date[]).map(d => d.getTime())));
    })();

    const visiblePoints = effectiveStart ? allPoints.filter(p => p.date >= effectiveStart) : allPoints;
    const visiblePrimaryData = effectiveStart ? primaryData.filter(p => p.date >= effectiveStart) : primaryData;

    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = CSS_HEIGHT - MARGIN.top - MARGIN.bottom;

    const xExtent = extent(visiblePoints, d => d.date) as [Date, Date];
    const xDomain: [Date, Date] = xExtent[0] ? xExtent : [new Date(2000, 0, 1), new Date()];
    const xScale = scaleTime().domain(xDomain).range([0, innerWidth]);

    const yExtent = visiblePoints.length > 0 ? (extent(visiblePoints, d => d.value) as [number, number]) : [0, 1];
    const yScale = scaleLinear().domain([Math.min(0, yExtent[0]), yExtent[1]]).nice(6).range([innerHeight, 0]);

    const yTicks = yScale.ticks(6);
    const xTicks = computeXTicks(visiblePrimaryData, innerWidth, xDomain);

    const lineGen = line<ParsedObservation>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value));

    const bisectDate = bisector((d: ParsedObservation) => d.date).center;

    function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
        const bounds = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - bounds.left - MARGIN.left;
        setHoveredIndex(bisectDate(visiblePrimaryData, xScale.invert(mouseX)));
    }

    // ── derived display values ─────────────────────────────────────────────────

    const primaryMeta = metaMap[seriesIds[0]];

    const resolvedTitle = title ?? (
        isMulti
            ? (seriesIds.every(id => metaMap[id]?.title)
                ? seriesIds.map(id => metaMap[id]!.title).join(" vs ")
                : null)
            : (primaryMeta?.title ?? seriesIds[0])
    );

    const legendEntries: LegendEntry[] = isMulti ? seriesConfigs.map((cfg, i) => ({
        id: cfg.id,
        label: cfg.label
            ? <Katex formula={cfg.label} display={false} />
            : (metaMap[cfg.id]?.title ?? cfg.id),
        swatch: "solid" as const,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
    })) : [];

    // footer: use full legend grid once all labels + meta are ready
    const allHaveLabels = isMulti && seriesConfigs.every(cfg => cfg.label);
    const allMetaReady = seriesIds.every(id => metaMap[id]?.title);
    const footerLegend: SeriesLegendEntry[] | undefined = allHaveLabels && allMetaReady
        ? seriesConfigs.map(cfg => ({
            id: cfg.id,
            label: cfg.label!,
            metaTitle: metaMap[cfg.id]!.title!,
        }))
        : undefined;
    const footerLinks: SeriesLink[] | undefined = !footerLegend
        ? seriesIds.map(id => ({ id }))
        : undefined;

    // ── render ─────────────────────────────────────────────────────────────────

    return (
        <div style={{ width: "100%", marginBottom: "20px" }}>
            {resolvedTitle != null && (
                <ChartTitle formula={!isMulti ? seriesConfigs[0].label : undefined}>{resolvedTitle}</ChartTitle>
            )}
            <ChartLegend entries={legendEntries} />

            <div ref={containerRef} style={{ width: "100%" }}>
                <ChartPlaceholder loading={loading} error={error} />

                {!loading && !error && width > 0 && (
                    <svg width={width} height={CSS_HEIGHT} style={{ display: "block" }}>
                        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>

                            <ChartAxes
                                xScale={xScale}
                                yScale={yScale}
                                innerWidth={innerWidth}
                                innerHeight={innerHeight}
                                xTicks={xTicks}
                                yTicks={yTicks}
                            />

                            {seriesIds.map((id, i) => {
                                const raw = allData[id];
                                if (!raw) return null;
                                const d = effectiveStart ? raw.filter(p => p.date >= effectiveStart) : raw;
                                const pathD = lineGen(d);
                                return pathD ? (
                                    <path
                                        key={id}
                                        d={pathD}
                                        fill="none"
                                        stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                                        strokeWidth={1.5}
                                        strokeLinejoin="round"
                                    />
                                ) : null;
                            })}

                            {hoveredIndex !== null && visiblePrimaryData[hoveredIndex] && (() => {
                                const hov = visiblePrimaryData[hoveredIndex];
                                const hx = xScale(hov.date);
                                const dateStr = hov.date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                                const tp = { fontFamily: "ui-serif, Georgia, serif" as const, fontSize: 12, fill: "#1a1a1a" };

                                const rows = seriesConfigs.map((cfg, i) => {
                                    const d = allData[cfg.id] ?? [];
                                    const idx = d.length > 0 ? bisectDate(d, hov.date) : -1;
                                    const pt = idx >= 0 ? d[idx] : null;
                                    const label = cfg.labelHover ?? cfg.label ?? (isMulti ? cfg.id : "");
                                    const valueStr = pt ? formatHoverValue(pt.value) : "—";
                                    return {
                                        id: cfg.id,
                                        color: CHART_PALETTE[i % CHART_PALETTE.length],
                                        text: label ? `${label}: ${valueStr}` : valueStr,
                                        hy: pt ? yScale(pt.value) : null,
                                    };
                                });

                                const labelW = Math.max(...rows.map(r => measureTextWidth(r.text, 12)));
                                const contentW = Math.max(measureTextWidth(dateStr, 12), SWATCH_W + SWATCH_GAP + labelW);
                                const contentH = TOOLTIP_LINE_H + rows.length * TOOLTIP_LINE_H;
                                const geo = tooltipGeometry(hx, innerWidth, contentW, contentH);

                                return (
                                    <ChartTooltip hx={hx} innerHeight={innerHeight} dateStr={dateStr} {...geo}>
                                        {rows.map(r => r.hy !== null ? (
                                            <circle key={`dot-${r.id}`} cx={hx} cy={r.hy as number} r={3.5} fill={r.color} />
                                        ) : null)}
                                        {rows.map((r, i) => (
                                            <g key={r.id}>
                                                <rect
                                                    x={geo.baseX}
                                                    y={TOOLTIP_FIRST_ROW_Y + i * TOOLTIP_LINE_H + TOOLTIP_LINE_H / 2 - 1.5}
                                                    width={SWATCH_W} height={3}
                                                    fill={r.color}
                                                />
                                                <text
                                                    x={geo.baseX + SWATCH_W + SWATCH_GAP}
                                                    y={TOOLTIP_FIRST_ROW_Y + i * TOOLTIP_LINE_H + TOOLTIP_LINE_H / 2}
                                                    dominantBaseline="middle"
                                                    {...tp}
                                                >
                                                    {r.text}
                                                </text>
                                            </g>
                                        ))}
                                    </ChartTooltip>
                                );
                            })()}

                            <rect
                                x={-MARGIN.left} y={0}
                                width={innerWidth + MARGIN.left + MARGIN.right}
                                height={innerHeight}
                                fill="none"
                                pointerEvents="all"
                                onMouseMove={handleMouseMove}
                                onMouseLeave={() => setHoveredIndex(null)}
                                style={{ cursor: "crosshair" }}
                            />

                        </g>
                    </svg>
                )}
            </div>

            <ChartFooter
                cite={cite}
                units={primaryMeta?.units}
                seasonalAdj={primaryMeta?.seasonalAdj}
                frequency={primaryMeta?.frequency}
                lastUpdated={primaryMeta?.lastUpdated ?? null}
                seriesLinks={footerLinks}
                seriesLegend={footerLegend}
            />
        </div>
    );
}
