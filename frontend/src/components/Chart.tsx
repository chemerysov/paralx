import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    scaleTime,
    scaleLinear,
    extent,
    max,
    line,
    timeYear,
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
}

export default function Chart({ series }: ChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [data, setData] = useState<ParsedObservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    if (loading) {
        return (
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
        );
    }

    if (error) {
        return (
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
        );
    }

    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = CSS_HEIGHT - MARGIN.top - MARGIN.bottom;

    const xScale = scaleTime()
        .domain(extent(data, d => d.date) as [Date, Date])
        .range([0, innerWidth]);

    const yScale = scaleLinear()
        .domain([0, max(data, d => d.value) as number])
        .nice()
        .range([innerHeight, 0]);

    const yTicks = yScale.ticks(6);
    const xTicks = xScale.ticks(timeYear.every(10)!);

    const lineGenerator = line<ParsedObservation>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value));

    const pathD = lineGenerator(data);

    return (
        <div ref={containerRef} style={{ width: "100%" }}>
            {width > 0 && (
                <svg
                    width={width}
                    height={CSS_HEIGHT}
                    style={{ display: "block" }}
                >
                    <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>

                        {/* y-axis gridlines and labels */}
                        {yTicks.map(tick => (
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
                                    fontSize={11}
                                >
                                    {tick === 0
                                        ? "0"
                                        : (tick / 1000).toFixed(0) + "k"}
                                </text>
                            </g>
                        ))}

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
                                    fontSize={11}
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

                    </g>
                </svg>
            )}
        </div>
    );
}
