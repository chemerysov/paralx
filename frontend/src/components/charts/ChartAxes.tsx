import type { ScaleTime, ScaleLinear } from "d3";
import { formatAxisValue } from "./chartShared";

interface ChartAxesProps {
    xScale: ScaleTime<number, number>;
    yScale: ScaleLinear<number, number>;
    innerWidth: number;
    innerHeight: number;
    xTicks: Date[];
    yTicks: number[];
}

export default function ChartAxes({ xScale, yScale, innerWidth, innerHeight, xTicks, yTicks }: ChartAxesProps) {
    const yMax = yScale.domain()[1] as number;
    return (
        <>
            {/* y-axis gridlines and labels — last tick omitted, drawn separately as top edge */}
            {yTicks.slice(0, -1).map(tick => (
                <g key={tick}>
                    <line
                        x1={0} y1={yScale(tick)} x2={innerWidth} y2={yScale(tick)}
                        stroke={tick === 0 ? "#c8c8c4" : "#e0e0dc"}
                        strokeWidth={tick === 0 ? 1 : 0.5}
                    />
                    <text
                        x={-10} y={yScale(tick)}
                        textAnchor="end" dominantBaseline="middle"
                        fill="#888884" fontFamily="ui-serif, Georgia, serif" fontSize={13}
                    >
                        {formatAxisValue(tick, yMax)}
                    </text>
                </g>
            ))}

            {/* top gridline with label */}
            <g>
                <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="#e0e0dc" strokeWidth={0.5} />
                <text
                    x={-10} y={0}
                    textAnchor="end" dominantBaseline="middle"
                    fill="#888884" fontFamily="ui-serif, Georgia, serif" fontSize={13}
                >
                    {formatAxisValue(yMax, yMax)}
                </text>
            </g>

            {/* x-axis baseline */}
            <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#e0e0dc" strokeWidth={1} />

            {/* x-axis tick marks and labels */}
            {xTicks.map(tick => (
                <g key={tick.getTime()}>
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
                        {tick.getFullYear()}
                    </text>
                </g>
            ))}
        </>
    );
}
