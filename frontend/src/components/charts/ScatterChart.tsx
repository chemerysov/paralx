import {
    useEffect,
    useState,
    type ReactNode,
} from "react";

import {
    scaleLinear,
    extent,
} from "d3";

import {
    MARGIN, CSS_HEIGHT,
    type Observation,
    formatAxisValue, formatHoverValue, measureTextWidth,
    TOOLTIP_DATE_Y, TOOLTIP_LINE_H, TOOLTIP_FIRST_ROW_Y,
    tooltipGeometry,
    CHART_PALETTE, SWATCH_W, SWATCH_GAP,
} from "./chartShared";
import { useContainerWidth } from "./useContainerWidth";
import ChartFooter, { type SeriesLegendEntry } from "./ChartFooter";
import ChartTitle from "./ChartTitle";
import ChartPlaceholder from "./ChartPlaceholder";
import Katex from "../Katex";


export interface ScatterSeriesConfig {
    id: string;
    label?: string;      // KaTeX formula: footer legend
    labelHover?: string; // plain text: hover tooltip (falls back to label then id)
}

interface SeriesMeta {
    title?: string;
    units?: string;
    seasonalAdj?: string;
    frequency?: string;
    lastUpdated?: string;
}

interface ScatterChartProps {
    leftSeries: string | ScatterSeriesConfig;
    bottomSeries: string | ScatterSeriesConfig;
    title?: ReactNode;
    cite?: ReactNode;
}

interface ScatterPoint {
    date: Date;
    x: number;
    y: number;
}

function dateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export default function ScatterChart({ leftSeries, bottomSeries, title, cite }: ScatterChartProps) {
    // leftSeries → y-axis (vertical, left); bottomSeries → x-axis (horizontal, bottom)
    const yCfg: ScatterSeriesConfig = typeof leftSeries === "string" ? { id: leftSeries } : leftSeries;
    const xCfg: ScatterSeriesConfig = typeof bottomSeries === "string" ? { id: bottomSeries } : bottomSeries;

    const [containerRef, width] = useContainerWidth();
    const [points, setPoints] = useState<ScatterPoint[]>([]);
    const [metaMap, setMetaMap] = useState<Record<string, SeriesMeta>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        setPoints([]);
        setMetaMap({});
        setLoading(true);
        setError(null);

        const ids = [xCfg.id, yCfg.id];

        ids.forEach(id => {
            fetch(`/api/series/${id}/meta`)
                .then(res => res.ok ? res.json() : null)
                .then(meta => {
                    if (!meta || cancelled) return;
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
        });

        Promise.all(
            ids.map(id =>
                fetch(`/api/series/${id}`)
                    .then(res => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return res.json();
                    })
                    .then((raw: Observation[]) =>
                        raw.map(d => ({
                            date: new Date(d.date + "T00:00:00"),
                            value: d.value,
                        }))
                    )
                    .then(parsed => ({ id, parsed }))
            )
        ).then(results => {
            if (cancelled) return;
            const xData = results[0].parsed;
            const yData = results[1].parsed;
            const yMap = new Map(yData.map(p => [dateKey(p.date), p.value]));
            const aligned: ScatterPoint[] = xData
                .filter(p => yMap.has(dateKey(p.date)))
                .map(p => ({ date: p.date, x: p.value, y: yMap.get(dateKey(p.date))! }));
            setPoints(aligned);
            setLoading(false);
        }).catch(() => {
            if (!cancelled) {
                setError("Failed to load data.");
                setLoading(false);
            }
        });

        return () => { cancelled = true; };
    }, [xCfg.id, yCfg.id]);

    const hasXLabel = !!xCfg.label;
    const hasYLabel = !!yCfg.label;
    const sm = {
        top: MARGIN.top,
        right: MARGIN.right,
        bottom: hasXLabel ? 58 : MARGIN.bottom,
        left: hasYLabel ? 72 : MARGIN.left,
    };

    const innerWidth = width - sm.left - sm.right;
    const innerHeight = CSS_HEIGHT - sm.top - sm.bottom;

    const xExtent = points.length > 0 ? (extent(points, d => d.x) as [number, number]) : [0, 1];
    const yExtent = points.length > 0 ? (extent(points, d => d.y) as [number, number]) : [0, 1];

    const prelimXScale = scaleLinear().domain([xExtent[0], xExtent[1]]).nice(6);
    const allXTicks = prelimXScale.ticks(6);
    const xStep = allXTicks.length > 1 ? allXTicks[1] - allXTicks[0] : 1;
    const lastXTick = allXTicks[allXTicks.length - 1];
    // If the last nice tick overshoots the data max by more than half a step,
    // drop it and end the domain just past the data instead.
    const clipLast = lastXTick - xExtent[1] > xStep * 0.5;
    const xTicks = clipLast ? allXTicks.slice(0, -1) : allXTicks;
    const xDomainEnd = clipLast ? xExtent[1] + xStep * 0.05 : lastXTick;
    const xScale = scaleLinear()
        .domain([xTicks[0] ?? xExtent[0], xDomainEnd])
        .range([0, innerWidth]);

    const yScale = scaleLinear().domain([yExtent[0], yExtent[1]]).nice(6).range([innerHeight, 0]);
    const yTicks = yScale.ticks(6);
    const [, xDomainMax] = xScale.domain() as [number, number];
    const [, yDomainMax] = yScale.domain() as [number, number];

    function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
        if (points.length === 0) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - bounds.left - sm.left;
        const my = e.clientY - bounds.top;
        let nearest = 0;
        let minDist = Infinity;
        for (let i = 0; i < points.length; i++) {
            const dx = xScale(points[i].x) - mx;
            const dy = yScale(points[i].y) - my;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) { minDist = dist; nearest = i; }
        }
        setHoveredIdx(nearest);
    }

    const xMeta = metaMap[xCfg.id];
    const yMeta = metaMap[yCfg.id];

    const resolvedTitle = title ?? (
        yMeta?.title && xMeta?.title
            ? `${yMeta.title} vs ${xMeta.title}`
            : null
    );

    const bothHaveLabels = !!(xCfg.label && yCfg.label);
    const bothMetaReady = !!(xMeta?.title && yMeta?.title);
    const seriesLegend: SeriesLegendEntry[] | undefined = bothHaveLabels && bothMetaReady
        ? [
            { id: xCfg.id, label: xCfg.label!, metaTitle: xMeta!.title! },
            { id: yCfg.id, label: yCfg.label!, metaTitle: yMeta!.title! },
        ]
        : undefined;
    const seriesLinks = !seriesLegend ? [{ id: xCfg.id }, { id: yCfg.id }] : undefined;

    const tp = { fontFamily: "ui-serif, Georgia, serif" as const, fontSize: 12, fill: "#1a1a1a" };

    return (
        <div style={{ width: "100%", marginBottom: "20px" }}>
            {resolvedTitle != null && <ChartTitle>{resolvedTitle}</ChartTitle>}

            <div ref={containerRef} style={{ width: "100%" }}>
                <ChartPlaceholder loading={loading} error={error} />

                {!loading && !error && width > 0 && points.length > 0 && (
                    <svg width={width} height={CSS_HEIGHT} style={{ display: "block" }}>
                        <g transform={`translate(${sm.left}, ${sm.top})`}>

                            {yTicks.slice(0, -1).map(tick => (
                                <g key={tick}>
                                    <line
                                        x1={0} y1={yScale(tick)} x2={innerWidth} y2={yScale(tick)}
                                        stroke="#e0e0dc"
                                        strokeWidth={0.5}
                                    />
                                    <text
                                        x={-10} y={yScale(tick)}
                                        textAnchor="end" dominantBaseline="middle"
                                        fill="#888884" fontFamily="ui-serif, Georgia, serif" fontSize={13}
                                    >
                                        {formatAxisValue(tick, yDomainMax)}
                                    </text>
                                </g>
                            ))}
                            <g>
                                <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="#e0e0dc" strokeWidth={0.5} />
                                <text
                                    x={-10} y={0}
                                    textAnchor="end" dominantBaseline="middle"
                                    fill="#888884" fontFamily="ui-serif, Georgia, serif" fontSize={13}
                                >
                                    {formatAxisValue(yDomainMax, yDomainMax)}
                                </text>
                            </g>

                            <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#e0e0dc" strokeWidth={1} />
                            {xTicks.map(tick => (
                                <g key={tick}>
                                    <line
                                        x1={xScale(tick)} y1={innerHeight}
                                        x2={xScale(tick)} y2={innerHeight + 4}
                                        stroke="#c8c8c4" strokeWidth={1}
                                    />
                                    <text
                                        x={xScale(tick)} y={innerHeight + 8}
                                        textAnchor="middle" dominantBaseline="hanging"
                                        fill="#888884" fontFamily="ui-serif, Georgia, serif" fontSize={13}
                                    >
                                        {formatAxisValue(tick, xDomainMax)}
                                    </text>
                                </g>
                            ))}

                            {points.map((pt, i) => (
                                <circle
                                    key={i}
                                    cx={xScale(pt.x)}
                                    cy={yScale(pt.y)}
                                    r={3}
                                    fill={CHART_PALETTE[0]}
                                    fillOpacity={i === hoveredIdx ? 1 : 0.5}
                                />
                            ))}

                            {hoveredIdx !== null && points[hoveredIdx] && (() => {
                                const pt = points[hoveredIdx];
                                const hx = xScale(pt.x);
                                const hy = yScale(pt.y);
                                const dateStr = pt.date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                                const xLabel = xCfg.labelHover ?? xCfg.label ?? xCfg.id;
                                const yLabel = yCfg.labelHover ?? yCfg.label ?? yCfg.id;
                                const rows = [
                                    { text: `${xLabel}: ${formatHoverValue(pt.x)}`, color: CHART_PALETTE[0] },
                                    { text: `${yLabel}: ${formatHoverValue(pt.y)}`, color: CHART_PALETTE[1] },
                                ];
                                const labelW = Math.max(...rows.map(r => measureTextWidth(r.text, 12)));
                                const contentW = Math.max(measureTextWidth(dateStr, 12), SWATCH_W + SWATCH_GAP + labelW);
                                const contentH = TOOLTIP_LINE_H + rows.length * TOOLTIP_LINE_H;
                                const geo = tooltipGeometry(hx, innerWidth, contentW, contentH);

                                return (
                                    <g pointerEvents="none">
                                        <rect
                                            x={geo.rectX} y={geo.rectY}
                                            width={geo.rectW} height={geo.rectH}
                                            fill="#f8f8f6" fillOpacity={0.72}
                                            stroke="#e0e0dc" strokeWidth={0.5}
                                            rx={3}
                                        />
                                        <text
                                            x={geo.rectX + geo.rectW / 2}
                                            y={TOOLTIP_DATE_Y}
                                            textAnchor="middle"
                                            dominantBaseline="hanging"
                                            {...tp}
                                        >
                                            {dateStr}
                                        </text>
                                        {rows.map((r, i) => (
                                            <g key={i}>
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
                                        <circle cx={hx} cy={hy} r={5} fill={CHART_PALETTE[0]} />
                                    </g>
                                );
                            })()}

                            <rect
                                x={-sm.left} y={0}
                                width={innerWidth + sm.left + sm.right}
                                height={innerHeight}
                                fill="none"
                                pointerEvents="all"
                                onMouseMove={handleMouseMove}
                                onMouseLeave={() => setHoveredIdx(null)}
                                style={{ cursor: "crosshair" }}
                            />

                            {hasXLabel && (
                                <foreignObject
                                    x={innerWidth / 2 - 60}
                                    y={innerHeight + 36}
                                    width={120}
                                    height={20}
                                    style={{ overflow: "visible" }}
                                >
                                    <div style={{
                                        textAlign: "center",
                                        fontSize: "13px",
                                        color: "#888884",
                                        fontFamily: "ui-serif, Georgia, serif",
                                    }}>
                                        <Katex formula={xCfg.label!} display={false} />
                                    </div>
                                </foreignObject>
                            )}

                            {hasYLabel && (
                                <foreignObject
                                    x={-sm.left + 4}
                                    y={innerHeight / 2 - 10}
                                    width={sm.left / 2 - 4}
                                    height={20}
                                    overflow="visible"
                                    style={{ overflow: "visible" }}
                                >
                                    <div style={{
                                        textAlign: "center",
                                        fontSize: "13px",
                                        color: "#888884",
                                        fontFamily: "ui-serif, Georgia, serif",
                                    }}>
                                        <Katex formula={yCfg.label!} display={false} />
                                    </div>
                                </foreignObject>
                            )}

                        </g>
                    </svg>
                )}
            </div>

            <ChartFooter
                cite={cite}
                units={xMeta?.units}
                seasonalAdj={xMeta?.seasonalAdj}
                frequency={xMeta?.frequency}
                lastUpdated={xMeta?.lastUpdated ?? null}
                seriesLinks={seriesLinks}
                seriesLegend={seriesLegend}
            />
        </div>
    );
}
