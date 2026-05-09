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

import {
    MARGIN, CSS_HEIGHT, type Observation, formatHoverValue, measureTextWidth, computeXTicks,
    TOOLTIP_PAD_X, TOOLTIP_PAD_Y, TOOLTIP_LINE_H, TOOLTIP_DATE_Y, TOOLTIP_FIRST_ROW_Y,
    tooltipGeometry,
    CHART_PALETTE, CHART_TOTAL_COLOR, SWATCH_W, SWATCH_GAP,
} from "./chartShared";
import { useContainerWidth } from "./useContainerWidth";
import ChartFooter, { type SeriesLegendEntry } from "./ChartFooter";
import ChartTitle from "./ChartTitle";
import ChartLegend, { type LegendEntry } from "./ChartLegend";
import ChartPlaceholder from "./ChartPlaceholder";
import ChartAxes from "./ChartAxes";
import ChartTooltip from "./ChartTooltip";



export interface StackedSeriesConfig {
    id: string;
    label: string;
    labelHover?: string;
    sign: 1 | -1;
    isTotal?: boolean;
    unstable?: boolean;
}

interface StackedChartProps {
    series: StackedSeriesConfig[];
    // title is required — StackedChart has no auto-generation from meta
    title: string;
    titleFormula?: string;
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


export default function StackedChart({ series, title, titleFormula, cite }: StackedChartProps) {
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

    const stackSeries  = series.filter(s => !s.isTotal);
    const bandSeries   = stackSeries.filter(s => !s.unstable);
    const unstableSeries = stackSeries.filter(s => s.unstable);
    const totalSeries  = series.find(s => s.isTotal) ?? null;

    // assign palette colors: non-total series get CHART_PALETTE in order, total gets CHART_TOTAL_COLOR
    const colorMap: Record<string, string> = {};
    let paletteIdx = 0;
    for (const s of series) {
        colorMap[s.id] = s.isTotal ? CHART_TOTAL_COLOR : CHART_PALETTE[paletteIdx++ % CHART_PALETTE.length];
    }

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

    const bands = aligned.length > 0 ? computeBands(aligned, bandSeries) : {};

    const epsRawData = totalSeries && aligned.length > 0
        ? aligned.map(pt => ({
            date: pt.date,
            value: (pt.values[totalSeries.id] ?? 0) - stackSeries.reduce(
                (acc, cfg) => acc + (cfg.sign === 1 ? (pt.values[cfg.id] ?? 0) : -(pt.values[cfg.id] ?? 0)), 0
            ),
        }))
        : null;

    const allBandY = Object.values(bands).flatMap(bd => bd.flatMap(p => [p.y0, p.y1]));
    const unstableY = unstableSeries.flatMap(s => aligned.map(pt => pt.values[s.id] ?? 0));
    const epsY = epsRawData ? epsRawData.map(p => p.value) : [];
    const allY = [...allBandY, ...unstableY, ...epsY];
    const yDataMin = allY.length > 0 ? Math.min(...allY) : 0;
    const yDataMax = allY.length > 0 ? Math.max(...allY) : 1;

    const xScale = scaleTime()
        .domain(aligned.length > 0 ? (extent(aligned, d => d.date) as [Date, Date]) : [new Date(), new Date()])
        .range([0, innerWidth]);

    const yScale = scaleLinear()
        .domain([Math.min(0, yDataMin), yDataMax])
        .nice(6)
        .range([innerHeight, 0]);

    const yTicks = yScale.ticks(6);
    const [, yDomainMax] = yScale.domain() as [number, number];

    const xTicks = computeXTicks(aligned, innerWidth, xScale.domain() as [Date, Date]);

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

    const epsPathD = epsRawData ? totalLineGenerator(epsRawData) : null;

    const unstablePaths = aligned.length > 0
        ? unstableSeries.map(s => ({
            id: s.id,
            d: totalLineGenerator(aligned.map(pt => ({ date: pt.date, value: pt.values[s.id] ?? 0 }))),
        }))
        : [];

    const bisectDate = bisector((d: AlignedPoint) => d.date).center;

    function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
        const bounds = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - bounds.left - MARGIN.left;
        setHoveredIndex(bisectDate(aligned, xScale.invert(mouseX)));
    }

    const hoveredPoint = hoveredIndex !== null ? aligned[hoveredIndex] : null;

    const seriesLegend: SeriesLegendEntry[] = series
        .filter(s => seriesMeta[s.id])
        .map(s => ({
            id: s.id,
            label: s.label,
            metaTitle: seriesMeta[s.id],
        }));

    const epsFormula = totalSeries
        ? (() => {
            const terms = stackSeries.map((cfg, i) => {
                if (i === 0) return cfg.label;
                return cfg.sign === 1 ? `+ ${cfg.label}` : `- ${cfg.label}`;
            }).join(" ");
            return `${totalSeries.label} - \\left(${terms}\\right)`;
        })()
        : undefined;

    const legendEntries: LegendEntry[] = [
        ...series.map(s => ({
            id: s.id,
            label: <Katex formula={s.label} display={false} />,
            swatch: (s.isTotal ? "dashed" : s.unstable ? "solid" : "area") as LegendEntry["swatch"],
            color: colorMap[s.id],
        })),
        ...(epsRawData ? [{
            id: "ε",
            label: <Katex formula="\varepsilon" display={false} />,
            swatch: "dotted" as LegendEntry["swatch"],
            color: CHART_TOTAL_COLOR,
        }] : []),
    ];

    return (
        <div style={{ width: "100%", marginBottom: "20px" }}>
            <ChartTitle formula={titleFormula}>{title}</ChartTitle>
            <ChartLegend entries={legendEntries} />

            <div ref={containerRef} style={{ width: "100%" }}>
                <ChartPlaceholder loading={loading} error={error} />

                {!loading && !error && width > 0 && aligned.length > 0 && (
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

                            {stackSeries.map(cfg => {
                                const bandData = bands[cfg.id];
                                if (!bandData) return null;
                                const pathD = makeAreaPath(bandData);
                                if (!pathD) return null;
                                return (
                                    <path
                                        key={cfg.id}
                                        d={pathD}
                                        fill={colorMap[cfg.id]}
                                        fillOpacity={0.82}
                                        stroke={colorMap[cfg.id]}
                                        strokeWidth={0.5}
                                        strokeOpacity={0.4}
                                    />
                                );
                            })}

                            {unstablePaths.map(({ id, d }) => d && (
                                <path
                                    key={id}
                                    d={d}
                                    fill="none"
                                    stroke={colorMap[id]}
                                    strokeWidth={1.5}
                                    strokeLinejoin="round"
                                />
                            ))}

                            {totalPathD && (
                                <path
                                    d={totalPathD}
                                    fill="none"
                                    stroke={totalSeries ? colorMap[totalSeries.id] : CHART_TOTAL_COLOR}
                                    strokeWidth={1.5}
                                    strokeLinejoin="round"
                                    strokeDasharray="4 2"
                                />
                            )}

                            {epsPathD && (
                                <path
                                    d={epsPathD}
                                    fill="none"
                                    stroke={CHART_TOTAL_COLOR}
                                    strokeWidth={1}
                                    strokeLinejoin="round"
                                    strokeDasharray="2 3"
                                />
                            )}

                            {hoveredPoint && (() => {
                                const hx = xScale(hoveredPoint.date);
                                const dateStr = hoveredPoint.date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                                const computedSum = stackSeries.reduce((acc, cfg) => {
                                    const val = hoveredPoint.values[cfg.id] ?? 0;
                                    return acc + (cfg.sign === 1 ? val : -val);
                                }, 0);
                                const eps = totalSeries
                                    ? (hoveredPoint.values[totalSeries.id] ?? 0) - computedSum
                                    : null;

                                type SwatchType = "area" | "solid" | "dashed" | "dotted";
                                type TRow = { key: string; labelSign: string; labelName: string; valSign: string; valNum: string; color: string; swatchType: SwatchType };
                                const rows: TRow[] = [
                                    ...series.map((cfg, i) => {
                                        const name = cfg.labelHover ?? cfg.label;
                                        const color = colorMap[cfg.id];
                                        const swatchType: SwatchType = cfg.isTotal ? "dashed" : cfg.unstable ? "solid" : "area";
                                        if (cfg.isTotal) return { key: cfg.id, labelSign: "=", labelName: name, valSign: "=", valNum: formatHoverValue(computedSum), color, swatchType };
                                        const formulaSign = cfg.sign === 1 ? "+" : "-";
                                        const rawVal = hoveredPoint.values[cfg.id] ?? 0;
                                        const isFirst = i === 0;
                                        const effectivePositive = cfg.sign === 1 ? rawVal >= 0 : rawVal <= 0;
                                        const effectiveSign = effectivePositive ? "+" : "-";
                                        return { key: cfg.id, labelSign: isFirst ? "" : formulaSign, labelName: name, valSign: isFirst ? (effectivePositive ? "" : "-") : effectiveSign, valNum: formatHoverValue(Math.abs(rawVal)), color, swatchType };
                                    }),
                                    ...(eps !== null ? [{ key: "ε", labelSign: "+", labelName: "ε", valSign: eps >= 0 ? "+" : "-", valNum: formatHoverValue(Math.abs(eps)), color: CHART_TOTAL_COLOR, swatchType: "dotted" as SwatchType }] : []),
                                ];

                                const GAP = 5;
                                const signCharW = measureTextWidth("+", 12);
                                const colonCharW = measureTextWidth(":", 12);
                                const maxNameW = Math.max(...rows.map(r => measureTextWidth(r.labelName, 12)));
                                const maxNumW = Math.max(...rows.map(r => measureTextWidth(r.valNum, 12)));
                                const c0 = 0;
                                const c1 = c0 + SWATCH_W + SWATCH_GAP;
                                const c2 = c1 + signCharW + GAP;
                                const c3 = c2 + maxNameW + GAP;
                                const c4 = c3 + colonCharW + GAP;
                                const c5 = c4 + signCharW + GAP;
                                const rowsW = c5 + maxNumW;
                                const contentW = Math.max(measureTextWidth(dateStr, 12), rowsW);

                                const lastRowY = TOOLTIP_FIRST_ROW_Y + (rows.length - 1) * TOOLTIP_LINE_H;
                                const contentH = lastRowY - TOOLTIP_DATE_Y + 12;
                                const geo = tooltipGeometry(hx, innerWidth, contentW, contentH);
                                const { baseX } = geo;

                                const textProps = {
                                    fontFamily: "ui-serif, Georgia, serif" as const,
                                    fontSize: 12,
                                    fill: "#1a1a1a",
                                };

                                return (
                                    <ChartTooltip hx={hx} innerHeight={innerHeight} dateStr={dateStr} {...geo}>
                                        {rows.map((row, i) => {
                                            const y = TOOLTIP_FIRST_ROW_Y + i * TOOLTIP_LINE_H;
                                            const swatchMidY = y + 4.5;
                                            return (
                                                <g key={row.key}>
                                                    {(row.swatchType === "area" || row.swatchType === "solid") ? (
                                                        <rect
                                                            x={baseX + c0} y={swatchMidY - 1.5}
                                                            width={SWATCH_W} height={3}
                                                            fill={row.color}
                                                            fillOpacity={row.swatchType === "area" ? 0.82 : 1}
                                                        />
                                                    ) : (
                                                        <line
                                                            x1={baseX + c0} y1={swatchMidY}
                                                            x2={baseX + c0 + SWATCH_W} y2={swatchMidY}
                                                            stroke={row.color}
                                                            strokeWidth={row.swatchType === "dotted" ? 1 : 1.5}
                                                            strokeDasharray={row.swatchType === "dashed" ? "4 2" : "2 3"}
                                                        />
                                                    )}
                                                    {row.labelSign && (
                                                        <text x={baseX + c1} y={y} textAnchor="start" dominantBaseline="hanging" {...textProps}>
                                                            {row.labelSign}
                                                        </text>
                                                    )}
                                                    <text x={baseX + c2} y={y} textAnchor="start" dominantBaseline="hanging" {...textProps}>
                                                        {row.labelName}
                                                    </text>
                                                    <text x={baseX + c3} y={y} textAnchor="start" dominantBaseline="hanging" {...textProps}>
                                                        :
                                                    </text>
                                                    {row.valSign && (
                                                        <text x={baseX + c4} y={y} textAnchor="start" dominantBaseline="hanging" {...textProps}>
                                                            {row.valSign}
                                                        </text>
                                                    )}
                                                    <text x={baseX + c5} y={y} textAnchor="start" dominantBaseline="hanging" {...textProps}>
                                                        {row.valNum}
                                                    </text>
                                                </g>
                                            );
                                        })}
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
                units={units}
                seasonalAdj={seasonalAdj}
                frequency={frequency}
                lastUpdated={lastUpdated}
                seriesLegend={seriesLegend}
                epsFormula={epsFormula}
            />
        </div>
    );
}
