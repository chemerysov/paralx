import {
    useEffect,
    useState,
    type ReactNode,
} from "react";

import {
    scaleTime,
    scaleLinear,
    extent,
    area,
    line,
    bisector,
} from "d3";

import Katex from "../Katex";

import { MARGIN, CSS_HEIGHT, type Observation, formatAxisValue, formatHoverValue, measureTextWidth } from "./chartShared";
import { useContainerWidth } from "./useContainerWidth";
import ChartFooter, { type SeriesLink, type SeriesLegendEntry } from "./ChartFooter";

// hover tooltip geometry
const TOOLTIP_PAD_X = 8;
const TOOLTIP_PAD_Y = 6;
const TOOLTIP_LINE_H = 16;
const TOOLTIP_DATE_Y = 10;
const TOOLTIP_FIRST_SERIES_Y = 28;
// small gap between the colon and the value column
const TOOLTIP_COL_GAP = 4;

export interface StackedSeriesConfig {
    id: string;
    label: string;
    labelHover?: string;
    color?: string;
    sign: 1 | -1;
    isTotal?: boolean;
}

interface StackedChartProps {
    series: StackedSeriesConfig[];
    // title is required — StackedChart has no auto-generation from meta
    title: string;
    cite?: ReactNode;
}

interface AlignedPoint {
    date: Date;
    values: Record<string, number>;
}

interface BandPoint {
    date: Date;
    y0: number;
    y1: number;
}

function dateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function alignSeries(
    fetched: Record<string, { date: Date; value: number }[]>
): AlignedPoint[] {
    const ids = Object.keys(fetched);
    if (ids.length === 0) return [];

    const dateSets = ids.map(id => new Set(fetched[id].map(p => dateKey(p.date))));
    const commonKeys = [...dateSets[0]].filter(k => dateSets.every(s => s.has(k)));

    const lookups: Record<string, Map<string, { date: Date; value: number }>> = {};
    for (const id of ids) {
        lookups[id] = new Map(fetched[id].map(p => [dateKey(p.date), p]));
    }

    return commonKeys
        .sort()
        .map(key => ({
            date: lookups[ids[0]].get(key)!.date,
            values: Object.fromEntries(ids.map(id => [id, lookups[id].get(key)?.value ?? 0])),
        }));
}

function computeBands(
    aligned: AlignedPoint[],
    configs: StackedSeriesConfig[]
): Record<string, BandPoint[]> {
    const result: Record<string, BandPoint[]> = {};
    for (const cfg of configs) result[cfg.id] = [];

    for (const pt of aligned) {
        let running = 0;
        for (const cfg of configs) {
            const value = pt.values[cfg.id] ?? 0;
            if (cfg.sign === 1) {
                result[cfg.id].push({ date: pt.date, y0: running, y1: running + value });
                running += value;
            } else {
                result[cfg.id].push({ date: pt.date, y0: -value, y1: 0 });
            }
        }
    }

    return result;
}

// returns the sign-prefixed label shown left of the colon in the hover tooltip
function hoverLabel(cfg: StackedSeriesConfig): string {
    const name = cfg.labelHover ?? cfg.label;
    if (cfg.isTotal) return `≈${name}`;
    return cfg.sign === 1 ? `+${name}` : `-${name}`;
}

// returns the sign-prefixed value shown right of the colon in the hover tooltip
function hoverValue(cfg: StackedSeriesConfig, raw: number): string {
    const v = formatHoverValue(raw);
    if (cfg.isTotal) return `≈${v}`;
    return cfg.sign === 1 ? `+${v}` : `-${v}`;
}

export default function StackedChart({ series, title, cite }: StackedChartProps) {
    const [containerRef, width] = useContainerWidth();
    const [aligned, setAligned] = useState<AlignedPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [units, setUnits] = useState<string | null>(null);
    const [seasonalAdj, setSeasonalAdj] = useState<string | null>(null);
    const [frequency, setFrequency] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [seriesMeta, setSeriesMeta] = useState<Record<string, string>>({});

    const stackSeries = series.filter(s => !s.isTotal);
    const totalSeries = series.find(s => s.isTotal) ?? null;

    useEffect(() => {
        const allIds = series.map(s => s.id);

        Promise.all(
            allIds.map(id =>
                fetch(`/api/series/${id}/meta`)
                    .then(res => res.ok ? res.json() : null)
                    .then(meta => ({ id, meta }))
                    .catch(() => ({ id, meta: null }))
            )
        ).then(results => {
            const metaMap: Record<string, string> = {};
            for (const { id, meta } of results) {
                if (meta?.title) metaMap[id] = meta.title;
            }
            setSeriesMeta(metaMap);

            const first = results[0]?.meta;
            if (first?.last_fetched_at) {
                setLastUpdated(new Date(first.last_fetched_at).toLocaleString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                    timeZoneName: "short",
                }));
            }
            if (first?.units) setUnits(first.units);
            if (first?.seasonal_adjustment) setSeasonalAdj(first.seasonal_adjustment);
            if (first?.frequency) setFrequency(first.frequency);
        });

        const fetchOne = (id: string) =>
            fetch(`/api/series/${id}`)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json() as Promise<Observation[]>;
                })
                .then((raw: Observation[]) =>
                    raw.map(d => ({
                        date: new Date(d.date + "T00:00:00"),
                        value: d.value,
                    }))
                );

        Promise.all(allIds.map(id => fetchOne(id).then(data => ({ id, data }))))
            .then(results => {
                const fetched: Record<string, { date: Date; value: number }[]> = {};
                for (const { id, data } of results) fetched[id] = data;
                setAligned(alignSeries(fetched));
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load data.");
                setLoading(false);
            });
    }, []);

    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = CSS_HEIGHT - MARGIN.top - MARGIN.bottom;

    const bands = aligned.length > 0 ? computeBands(aligned, stackSeries) : {};

    const allBandY = Object.values(bands).flatMap(bd => bd.flatMap(p => [p.y0, p.y1]));
    const yDataMin = allBandY.length > 0 ? Math.min(...allBandY) : 0;
    const yDataMax = allBandY.length > 0 ? Math.max(...allBandY) : 1;

    const xScale = scaleTime()
        .domain(aligned.length > 0 ? (extent(aligned, d => d.date) as [Date, Date]) : [new Date(), new Date()])
        .range([0, innerWidth]);

    const yScale = scaleLinear()
        .domain([Math.min(0, yDataMin), yDataMax])
        .nice(6)
        .range([innerHeight, 0]);

    const yTicks = yScale.ticks(6);
    const [, yDomainMax] = yScale.domain() as [number, number];

    const xTickInterval = (() => {
        if (aligned.length < 2) return 10;
        const spanYears =
            aligned[aligned.length - 1].date.getFullYear() - aligned[0].date.getFullYear();
        const maxTicks = Math.max(1, Math.floor(innerWidth / 60));
        const rawStep = spanYears / maxTicks;
        const niceSteps = [1, 2, 5, 10, 20, 25, 50];
        return niceSteps.find(s => s >= rawStep) ?? 50;
    })();

    const xTicks = (() => {
        if (aligned.length === 0) return [];
        const lastYear = aligned[aligned.length - 1].date.getFullYear();
        const firstYear = aligned[0].date.getFullYear();
        const [domainStart, domainEnd] = xScale.domain() as [Date, Date];
        const ticks: Date[] = [];
        for (let y = lastYear; y >= firstYear; y -= xTickInterval) {
            const t = new Date(y, 0, 1);
            if (t >= domainStart && t <= domainEnd) ticks.unshift(t);
        }
        return ticks;
    })();

    const makeAreaPath = (bandData: BandPoint[]) =>
        area<BandPoint>()
            .x(d => xScale(d.date))
            .y0(d => yScale(d.y0))
            .y1(d => yScale(d.y1))
            (bandData);

    const totalLineGenerator = line<{ date: Date; value: number }>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value));

    const totalPathD = totalSeries && aligned.length > 0
        ? totalLineGenerator(aligned.map(pt => ({ date: pt.date, value: pt.values[totalSeries.id] ?? 0 })))
        : null;

    const bisectDate = bisector((d: AlignedPoint) => d.date).center;

    function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
        const bounds = e.currentTarget.getBoundingClientRect();
        // subtract MARGIN.left because the capture rect starts MARGIN.left
        // pixels to the left of the xScale origin
        const mouseX = e.clientX - bounds.left - MARGIN.left;
        const date = xScale.invert(mouseX);
        setHoveredIndex(bisectDate(aligned, date));
    }

    const hoveredPoint = hoveredIndex !== null ? aligned[hoveredIndex] : null;

    const seriesLinks: SeriesLink[] = series.map(s => ({ id: s.id }));

    const seriesLegend: SeriesLegendEntry[] = series
        .filter(s => seriesMeta[s.id])
        .map(s => ({
            id: s.id,
            label: s.label,
            labelHover: s.labelHover,
            metaTitle: seriesMeta[s.id],
        }));

    return (
        <div style={{ width: "100%", marginBottom: "20px" }}>
            <p style={{
                margin: "0 0 8px 0",
                fontFamily: "ui-serif, Georgia, serif",
                fontSize: "1rem",
                color: "#1a1a1a",
                textAlign: "center",
                textWrap: "balance",
            }}>
                {title}
            </p>

            {/* legend */}
            <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                justifyContent: "center",
                marginBottom: "8px",
                fontFamily: "ui-serif, Georgia, serif",
                fontSize: "0.8rem",
                color: "#888884",
            }}>
                {series.map(s => (
                    <span key={s.id} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        {s.isTotal ? (
                            <span style={{
                                display: "inline-block",
                                width: "16px",
                                height: "0",
                                borderTop: `2px dashed ${s.color ?? "#1a1a1a"}`,
                                flexShrink: 0,
                            }} />
                        ) : (
                            <span style={{
                                display: "inline-block",
                                width: "12px",
                                height: "12px",
                                backgroundColor: s.color ?? "#1a1a1a",
                                borderRadius: "2px",
                                flexShrink: 0,
                                opacity: 0.85,
                            }} />
                        )}
                        {s.labelHover
                            ? <Katex formula={s.labelHover} display={false} />
                            : s.label
                        }
                    </span>
                ))}
            </div>

            <div ref={containerRef} style={{ width: "100%" }}>

                {loading && (
                    <div style={{
                        height: CSS_HEIGHT,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#888884",
                        fontSize: "0.9rem",
                    }}>
                        Loading
                    </div>
                )}

                {error && (
                    <div style={{
                        height: CSS_HEIGHT,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#888884",
                        fontSize: "0.9rem",
                    }}>
                        {error}
                    </div>
                )}

                {!loading && !error && width > 0 && aligned.length > 0 && (
                    <svg
                        width={width}
                        height={CSS_HEIGHT}
                        style={{ display: "block" }}
                    >
                        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>

                            {yTicks.slice(0, -1).map(tick => (
                                <g key={tick}>
                                    <line
                                        x1={0}
                                        y1={yScale(tick)}
                                        x2={innerWidth}
                                        y2={yScale(tick)}
                                        stroke={tick === 0 ? "#c8c8c4" : "#e0e0dc"}
                                        strokeWidth={tick === 0 ? 1 : 0.5}
                                    />
                                    <text
                                        x={-10}
                                        y={yScale(tick)}
                                        textAnchor="end"
                                        dominantBaseline="middle"
                                        fill="#888884"
                                        fontFamily="ui-serif, Georgia, serif"
                                        fontSize={13}
                                    >
                                        {formatAxisValue(tick, yDomainMax)}
                                    </text>
                                </g>
                            ))}

                            <g>
                                <line
                                    x1={0} y1={0}
                                    x2={innerWidth} y2={0}
                                    stroke="#e0e0dc"
                                    strokeWidth={0.5}
                                />
                                <text
                                    x={-10} y={0}
                                    textAnchor="end"
                                    dominantBaseline="middle"
                                    fill="#888884"
                                    fontFamily="ui-serif, Georgia, serif"
                                    fontSize={13}
                                >
                                    {formatAxisValue(yDomainMax, yDomainMax)}
                                </text>
                            </g>

                            <line
                                x1={0} y1={innerHeight}
                                x2={innerWidth} y2={innerHeight}
                                stroke="#e0e0dc"
                                strokeWidth={1}
                            />

                            {xTicks.map(tick => (
                                <g key={tick.getTime()}>
                                    <line
                                        x1={xScale(tick)} y1={innerHeight}
                                        x2={xScale(tick)} y2={innerHeight + 4}
                                        stroke="#c8c8c4"
                                        strokeWidth={1}
                                    />
                                    <text
                                        x={xScale(tick)}
                                        y={innerHeight + 8}
                                        textAnchor="middle"
                                        dominantBaseline="hanging"
                                        fill="#888884"
                                        fontFamily="ui-serif, Georgia, serif"
                                        fontSize={13}
                                    >
                                        {tick.getFullYear()}
                                    </text>
                                </g>
                            ))}

                            {stackSeries.map(cfg => {
                                const bandData = bands[cfg.id];
                                if (!bandData) return null;
                                const pathD = makeAreaPath(bandData);
                                if (!pathD) return null;
                                return (
                                    <path
                                        key={cfg.id}
                                        d={pathD}
                                        fill={cfg.color ?? "#1a1a1a"}
                                        fillOpacity={0.82}
                                        stroke={cfg.color ?? "#1a1a1a"}
                                        strokeWidth={0.5}
                                        strokeOpacity={0.4}
                                    />
                                );
                            })}

                            {totalPathD && (
                                <path
                                    d={totalPathD}
                                    fill="none"
                                    stroke={totalSeries?.color ?? "#1a1a1a"}
                                    strokeWidth={1.5}
                                    strokeLinejoin="round"
                                    strokeDasharray="4 2"
                                />
                            )}

                            {hoveredPoint && (() => {
                                const hx = xScale(hoveredPoint.date);
                                const flipLeft = hx > innerWidth / 2;

                                // compute tooltip text content
                                const dateStr = hoveredPoint.date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                                const labelStrs = series.map(cfg => hoverLabel(cfg));
                                const valueStrs = series.map(cfg => hoverValue(cfg, hoveredPoint.values[cfg.id] ?? 0));
                                const colonStr = ":";

                                // measure each column independently so the colon aligns
                                const maxLabelW = Math.max(...labelStrs.map(s => measureTextWidth(s, 12)));
                                const colonW = measureTextWidth(colonStr, 12);
                                const maxValueW = Math.max(...valueStrs.map(s => measureTextWidth(s, 12)));
                                const seriesRowW = maxLabelW + colonW + TOOLTIP_COL_GAP + maxValueW;
                                const contentW = Math.max(measureTextWidth(dateStr, 12), seriesRowW);

                                const lastSeriesY = TOOLTIP_FIRST_SERIES_Y + (series.length - 1) * TOOLTIP_LINE_H;
                                const contentH = lastSeriesY - TOOLTIP_DATE_Y + 12;
                                const rectH = contentH + TOOLTIP_PAD_Y * 2;
                                const rectW = contentW + TOOLTIP_PAD_X * 2;
                                const rectY = TOOLTIP_DATE_Y - TOOLTIP_PAD_Y;

                                // textLeft: x coordinate of the content area's left edge
                                const textLeft = flipLeft
                                    ? hx - 10 - contentW - TOOLTIP_PAD_X
                                    : hx + 10 - TOOLTIP_PAD_X;
                                const rectX = textLeft;

                                // colonX: x where label column ends and colon+value begins
                                const colonX = textLeft + TOOLTIP_PAD_X + maxLabelW;

                                const textProps = {
                                    fontFamily: "ui-serif, Georgia, serif" as const,
                                    fontSize: 12,
                                    fill: "#1a1a1a",
                                };

                                return (
                                    <g pointerEvents="none">
                                        <line
                                            x1={hx} y1={0}
                                            x2={hx} y2={innerHeight}
                                            stroke="#c8c8c4"
                                            strokeWidth={1}
                                        />
                                        <rect
                                            x={rectX} y={rectY}
                                            width={rectW} height={rectH}
                                            fill="#f8f8f6"
                                            fillOpacity={0.72}
                                            stroke="#e0e0dc"
                                            strokeWidth={0.5}
                                            rx={3}
                                        />
                                        {/* date spans full width, left-aligned at content left */}
                                        <text
                                            x={textLeft + TOOLTIP_PAD_X}
                                            y={TOOLTIP_DATE_Y}
                                            textAnchor="start"
                                            dominantBaseline="hanging"
                                            {...textProps}
                                        >
                                            {dateStr}
                                        </text>
                                        {/* series rows: label right-aligned at colonX, colon+value left-aligned after */}
                                        {series.map((cfg, i) => (
                                            <g key={cfg.id}>
                                                <text
                                                    x={colonX}
                                                    y={TOOLTIP_FIRST_SERIES_Y + i * TOOLTIP_LINE_H}
                                                    textAnchor="end"
                                                    dominantBaseline="hanging"
                                                    {...textProps}
                                                >
                                                    {labelStrs[i]}
                                                </text>
                                                <text
                                                    x={colonX + TOOLTIP_COL_GAP / 2}
                                                    y={TOOLTIP_FIRST_SERIES_Y + i * TOOLTIP_LINE_H}
                                                    textAnchor="start"
                                                    dominantBaseline="hanging"
                                                    {...textProps}
                                                >
                                                    {colonStr} {valueStrs[i]}
                                                </text>
                                            </g>
                                        ))}
                                    </g>
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
                units={units}
                seasonalAdj={seasonalAdj}
                frequency={frequency}
                lastUpdated={lastUpdated}
                seriesLinks={seriesLinks}
                seriesLegend={seriesLegend}
            />
        </div>
    );
}
