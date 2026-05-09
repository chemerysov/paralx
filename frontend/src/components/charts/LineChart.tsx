import {
    useEffect,
    useState,
    type ReactNode,
} from "react";

import {
    scaleTime,
    scaleLinear,
    extent,
    max,
    line,
    bisector,
} from "d3";

import Katex from "../Katex";

import { MARGIN, CSS_HEIGHT, type Observation, type ParsedObservation, formatAxisValue, formatHoverValue, measureTextWidth } from "./chartShared";
import { useContainerWidth } from "./useContainerWidth";
import ChartFooter from "./ChartFooter";

// hover tooltip geometry constants
const TOOLTIP_PAD_X = 8;
const TOOLTIP_PAD_Y = 6;

interface LineChartProps {
    series: string;
    title?: ReactNode;
    // titleFormula: KaTeX formula rendered inline after the title.
    // e.g. title="Real Gross Domestic Product" titleFormula="Y" renders:
    // Real Gross Domestic Product Y
    titleFormula?: string;
    cite?: ReactNode;
}

export default function LineChart({ series, title, titleFormula, cite }: LineChartProps) {
    const [containerRef, width] = useContainerWidth();
    const [data, setData] = useState<ParsedObservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [seriesTitle, setSeriesTitle] = useState<string | null>(null);
    const [units, setUnits] = useState<string | null>(null);
    const [seasonalAdj, setSeasonalAdj] = useState<string | null>(null);
    const [frequency, setFrequency] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    function fetchMeta() {
        fetch(`/api/series/${series}/meta`)
            .then(res => res.ok ? res.json() : null)
            .then(meta => {
                if (meta?.last_fetched_at) {
                    setLastUpdated(new Date(meta.last_fetched_at).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "UTC",
                        timeZoneName: "short",
                    }));
                }
                if (meta?.title) setSeriesTitle(meta.title);
                if (meta?.units) setUnits(meta.units);
                if (meta?.seasonal_adjustment) setSeasonalAdj(meta.seasonal_adjustment);
                if (meta?.frequency) setFrequency(meta.frequency);
            })
            .catch(() => {});
    }

    useEffect(() => {
        fetchMeta();
    }, [series]);

    useEffect(() => {
        fetch(`/api/series/${series}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((raw: Observation[]) => {
                setData(raw.map(d => ({
                    // appending T00:00:00 forces local time parsing
                    // rather than UTC midnight, avoiding date-off-by-one
                    // on timezones west of UTC
                    date: new Date(d.date + "T00:00:00"),
                    value: d.value,
                })));
                setLoading(false);
                fetchMeta();
            })
            .catch(() => {
                setError("Failed to load data.");
                setLoading(false);
            });
    }, [series]);

    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = CSS_HEIGHT - MARGIN.top - MARGIN.bottom;

    const xScale = scaleTime()
        .domain(extent(data, d => d.date) as [Date, Date])
        .range([0, innerWidth]);

    const yScale = scaleLinear()
        .domain([0, max(data, d => d.value) as number])
        .nice(6)
        .range([innerHeight, 0]);

    const yTicks = yScale.ticks(6);

    const xTickInterval = (() => {
        if (data.length < 2) return 10;
        const spanYears =
            data[data.length - 1].date.getFullYear() - data[0].date.getFullYear();
        const maxTicks = Math.max(1, Math.floor(innerWidth / 60));
        const rawStep = spanYears / maxTicks;
        const niceSteps = [1, 2, 5, 10, 20, 25, 50];
        return niceSteps.find(s => s >= rawStep) ?? 50;
    })();

    const xTicks = (() => {
        if (data.length === 0) return [];
        const lastYear = data[data.length - 1].date.getFullYear();
        const firstYear = data[0].date.getFullYear();
        const [domainStart, domainEnd] = xScale.domain() as [Date, Date];
        const ticks: Date[] = [];
        for (let y = lastYear; y >= firstYear; y -= xTickInterval) {
            const t = new Date(y, 0, 1);
            if (t >= domainStart && t <= domainEnd) ticks.unshift(t);
        }
        return ticks;
    })();

    const yMax = yScale.domain()[1] as number;

    const lineGenerator = line<ParsedObservation>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value));

    const pathD = lineGenerator(data);

    const bisectDate = bisector((d: ParsedObservation) => d.date).center;

    function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
        const bounds = e.currentTarget.getBoundingClientRect();
        // subtract MARGIN.left because the capture rect starts MARGIN.left
        // pixels to the left of the xScale origin
        const mouseX = e.clientX - bounds.left - MARGIN.left;
        const date = xScale.invert(mouseX);
        setHoveredIndex(bisectDate(data, date));
    }

    const hoveredPoint = hoveredIndex !== null ? data[hoveredIndex] : null;

    const resolvedTitle = title ?? seriesTitle ?? series;

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
                {resolvedTitle}
                {titleFormula && (
                    <> <Katex formula={titleFormula} display={false} /></>
                )}
            </p>
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

                {!loading && !error && width > 0 && (
                    <svg
                        width={width}
                        height={CSS_HEIGHT}
                        style={{ display: "block" }}
                    >
                        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>

                            {/* y-axis gridlines and labels — last tick omitted, drawn separately as top edge */}
                            {yTicks.slice(0, -1).map(tick => (
                                <g key={tick}>
                                    <line
                                        x1={0}
                                        y1={yScale(tick)}
                                        x2={innerWidth}
                                        y2={yScale(tick)}
                                        stroke="#e0e0dc"
                                        strokeWidth={0.5}
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
                                        {formatAxisValue(tick, yMax)}
                                    </text>
                                </g>
                            ))}

                            {/* top gridline with label */}
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
                                    {formatAxisValue(yMax, yMax)}
                                </text>
                            </g>

                            {/* x-axis baseline */}
                            <line
                                x1={0} y1={innerHeight}
                                x2={innerWidth} y2={innerHeight}
                                stroke="#e0e0dc"
                                strokeWidth={1}
                            />

                            {/* x-axis tick marks and labels */}
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

                            {/* data line */}
                            {pathD && (
                                <path
                                    d={pathD}
                                    fill="none"
                                    stroke="#1a1a1a"
                                    strokeWidth={1.5}
                                    strokeLinejoin="round"
                                />
                            )}

                            {/* hover visuals */}
                            {hoveredPoint && (() => {
                                const hx = xScale(hoveredPoint.date);
                                const hy = yScale(hoveredPoint.value);
                                const flipLeft = hx > innerWidth / 2;
                                const labelX = flipLeft ? hx - 10 : hx + 10;
                                const anchor = flipLeft ? "end" : "start";

                                // measure actual text widths so the rect fits its content
                                const dateStr = hoveredPoint.date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                                const valueStr = formatHoverValue(hoveredPoint.value);
                                const contentW = Math.max(
                                    measureTextWidth(dateStr, 12),
                                    measureTextWidth(valueStr, 12),
                                );
                                const rectH = 30 + TOOLTIP_PAD_Y * 2;
                                const rectW = contentW + TOOLTIP_PAD_X * 2;
                                const rectY = 10 - TOOLTIP_PAD_Y;
                                const rectX = flipLeft
                                    ? labelX - contentW - TOOLTIP_PAD_X
                                    : labelX - TOOLTIP_PAD_X;

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
                                        <circle cx={hx} cy={hy} r={3.5} fill="#1a1a1a" />
                                        <rect
                                            x={rectX} y={rectY}
                                            width={rectW} height={rectH}
                                            fill="#f8f8f6"
                                            fillOpacity={0.72}
                                            stroke="#e0e0dc"
                                            strokeWidth={0.5}
                                            rx={3}
                                        />
                                        <text
                                            x={labelX} y={10}
                                            textAnchor={anchor}
                                            dominantBaseline="hanging"
                                            {...textProps}
                                        >
                                            {dateStr}
                                        </text>
                                        <text
                                            x={labelX} y={28}
                                            textAnchor={anchor}
                                            dominantBaseline="hanging"
                                            {...textProps}
                                        >
                                            {formatHoverValue(hoveredPoint.value)}
                                        </text>
                                    </g>
                                );
                            })()}

                            {/* hover capture area — transparent, on top for events */}
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
                series={series}
            />
        </div>
    );
}
