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

export default function Chart() {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [data, setData] = useState<ParsedObservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/series/GDPC1")
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
    }, []);

    useEffect(() => {
        if (!data.length || !canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;

        const draw = () => {
            const container = containerRef.current;
            if (!container) return;

            const dpr = window.devicePixelRatio || 1;
            const cssWidth = container.clientWidth;

            canvas.width = cssWidth * dpr;
            canvas.height = CSS_HEIGHT * dpr;
            canvas.style.width = cssWidth + "px";
            canvas.style.height = CSS_HEIGHT + "px";

            const ctx = canvas.getContext("2d")!;
            ctx.scale(dpr, dpr);

            const innerWidth = cssWidth - MARGIN.left - MARGIN.right;
            const innerHeight = CSS_HEIGHT - MARGIN.top - MARGIN.bottom;

            const xScale = scaleTime()
                .domain(extent(data, d => d.date) as [Date, Date])
                .range([0, innerWidth]);

            const yScale = scaleLinear()
                .domain([0, max(data, d => d.value) as number])
                .nice()
                .range([innerHeight, 0]);

            ctx.clearRect(0, 0, cssWidth, CSS_HEIGHT);
            ctx.save();
            ctx.translate(MARGIN.left, MARGIN.top);

            // y axis gridlines and tick labels
            const yTicks = yScale.ticks(6);
            ctx.font = "11px ui-serif, Georgia, serif";
            ctx.fillStyle = "#888884";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            yTicks.forEach(tick => {
                const y = Math.round(yScale(tick));
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(innerWidth, y);
                ctx.strokeStyle = "#e0e0dc";
                ctx.lineWidth = 0.5;
                ctx.stroke();
                ctx.fillText(
                    tick === 0 ? "0" : (tick / 1000).toFixed(0) + "k",
                    -10,
                    y
                );
            });

            // x axis baseline
            ctx.beginPath();
            ctx.moveTo(0, innerHeight);
            ctx.lineTo(innerWidth, innerHeight);
            ctx.strokeStyle = "#e0e0dc";
            ctx.lineWidth = 1;
            ctx.stroke();

            // x axis tick marks and labels
            const xTicks = xScale.ticks(timeYear.every(10)!);
            ctx.fillStyle = "#888884";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            xTicks.forEach(tick => {
                const x = Math.round(xScale(tick));
                ctx.beginPath();
                ctx.moveTo(x, innerHeight);
                ctx.lineTo(x, innerHeight + 4);
                ctx.strokeStyle = "#c8c8c4";
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillText(String(tick.getFullYear()), x, innerHeight + 8);
            });

            // data line
            const lineGenerator = line<ParsedObservation>()
                .x(d => xScale(d.date))
                .y(d => yScale(d.value))
                .context(ctx);

            ctx.beginPath();
            lineGenerator(data);
            ctx.strokeStyle = "#1a1a1a";
            ctx.lineWidth = 1.5;
            ctx.lineJoin = "round";
            ctx.stroke();

            ctx.restore();
        };

        draw();

        // redraw on container resize, handles window resize and
        // orientation change on mobile
        const observer = new ResizeObserver(draw);
        observer.observe(containerRef.current!);
        return () => observer.disconnect();
    }, [data]);

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

    return (
        <div ref={containerRef} style={{ width: "100%" }}>
            <canvas ref={canvasRef} />
        </div>
    );
}
