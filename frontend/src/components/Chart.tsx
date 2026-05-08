import {
    useEffect,
    useRef,
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

interface Observation {
    date: string;
    value: number;
}

interface ParsedObservation {
    date: Date;
    value: number;
}

// d3 margin convention
const MARGIN = { top: 20, right: 20, bottom: 36, left: 56 };
const CSS_HEIGHT = 360;

interface ChartProps {
    series: string;
    title?: string;
    cite?: ReactNode;
}

export default function Chart({ series, title, cite }: ChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
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

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver(entries => {
            setWidth(entries[0].contentRect.width);
        });
        observer.observe(container);
        setWidth(container.clientWidth);
        return () => observer.disconnect();
    }, []);

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

    function formatAxisValue(v: number): string {
        if (v === 0) return "0";
        if (yMax >= 1000) return (v / 1000).toFixed(0) + "k";
        return Number.isInteger(v) ? String(v) : v.toFixed(1);
    }

    const lineGenerator = line<ParsedObservation>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value));

    const pathD = lineGenerator(data);

    const bisectDate = bisector((d: ParsedObservation) => d.date).center;

    function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
        const bounds = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - bounds.left;
        const date = xScale.invert(mouseX);
        const index = bisectDate(data, date);
        if (index >= 0 && index < data.length) {
            setHoveredIndex(index);
        }
    }

    function formatHoverValue(v: number): string {
        if (v === 0) return "0";
        if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "k";
        return v.toFixed(1);
    }

    const hoveredPoint = hoveredIndex !== null ? data[hoveredIndex] : null;

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
                {title ?? seriesTitle ?? series}
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

                            {/* y-axis gridlines and labels */}
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
                                        {formatAxisValue(tick)}
                                    </text>
                                </g>
                            ))}

                            {/* top gridline with label */}
                            <g>
                                <line
                                    x1={0}
                                    y1={0}
                                    x2={innerWidth}
                                    y2={0}
                                    stroke="#e0e0dc"
                                    strokeWidth={0.5}
                                />
                                <text
                                    x={-10}
                                    y={0}
                                    textAnchor="end"
                                    dominantBaseline="middle"
                                    fill="#888884"
                                    fontFamily="ui-serif, Georgia, serif"
                                    fontSize={13}
                                >
                                    {formatAxisValue(yMax)}
                                </text>
                            </g>

                            {/* x-axis baseline */}
                            <line
                                x1={0}
                                y1={innerHeight}
                                x2={innerWidth}
                                y2={innerHeight}
                                stroke="#e0e0dc"
                                strokeWidth={1}
                            />

                            {/* x-axis tick marks and labels */}
                            {xTicks.map(tick => (
                                <g key={tick.getTime()}>
                                    <line
                                        x1={xScale(tick)}
                                        y1={innerHeight}
                                        x2={xScale(tick)}
                                        y2={innerHeight + 4}
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
                            return (
                                <g pointerEvents="none">
                                    <line
                                        x1={hx} y1={0}
                                        x2={hx} y2={innerHeight}
                                        stroke="#c8c8c4"
                                        strokeWidth={1}
                                    />
                                    <circle
                                        cx={hx} cy={hy}
                                        r={3.5}
                                        fill="#1a1a1a"
                                    />
                                    <text
                                        x={labelX} y={10}
                                        textAnchor={anchor}
                                        dominantBaseline="hanging"
                                        fill="#1a1a1a"
                                        fontSize={12}
                                        fontFamily="ui-serif, Georgia, serif"
                                        stroke="#f8f8f6"
                                        strokeWidth={1}
                                        paintOrder="stroke"
                                    >
                                        {hoveredPoint.date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                    </text>
                                    <text
                                        x={labelX} y={28}
                                        textAnchor={anchor}
                                        dominantBaseline="hanging"
                                        fill="#888884"
                                        fontSize={12}
                                        fontFamily="ui-serif, Georgia, serif"
                                        stroke="#f8f8f6"
                                        strokeWidth={3}
                                        paintOrder="stroke"
                                    >
                                        {formatHoverValue(hoveredPoint.value)}
                                    </text>
                                </g>
                            );
                        })()}

                        {/* hover capture area — transparent, on top for events */}
                        <rect
                            x={0} y={0}
                            width={innerWidth}
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

            <p style={{
                display: "block",
                fontSize: "0.85rem",
                color: "#888884",
                fontStyle: "normal",
                fontFamily: "ui-serif, Georgia, serif",
                marginTop: "8px",
                marginBottom: "0",
            }}>
                {cite ?? (
                    <>
                        {(units || seasonalAdj) && (
                            <span style={{ display: "block" }}>
                                Units: {[units, seasonalAdj].filter(Boolean).join(", ")}
                            </span>
                        )}
                        {frequency && (
                            <span style={{ display: "block" }}>
                                Frequency: {frequency}
                            </span>
                        )}
                        <span style={{ display: "block" }}>
                            Source: Federal Reserve Bank of St. Louis,{" "}
                            <a
                                href={`https://fred.stlouisfed.org/series/${series}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#888884" }}
                            >
                                {series}
                            </a>
                        </span>
                        {lastUpdated && (
                            <span style={{ display: "block" }}>
                                Retrieved: {lastUpdated}
                            </span>
                        )}
                    </>
                )}
            </p>

        </div>
    );
}
