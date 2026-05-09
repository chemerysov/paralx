import type { ReactNode } from "react";
import { TOOLTIP_DATE_Y } from "./chartShared";

interface ChartTooltipProps {
    hx: number;
    innerHeight: number;
    rectX: number;
    rectY: number;
    rectW: number;
    rectH: number;
    dateStr: string;
    children?: ReactNode;
}

export default function ChartTooltip({
    hx,
    innerHeight,
    rectX,
    rectY,
    rectW,
    rectH,
    dateStr,
    children,
}: ChartTooltipProps) {
    return (
        <g pointerEvents="none">
            <line x1={hx} y1={0} x2={hx} y2={innerHeight} stroke="#c8c8c4" strokeWidth={1} />
            <rect
                x={rectX} y={rectY}
                width={rectW} height={rectH}
                fill="#f8f8f6" fillOpacity={0.72}
                stroke="#e0e0dc" strokeWidth={0.5}
                rx={3}
            />
            <text
                x={rectX + rectW / 2}
                y={TOOLTIP_DATE_Y}
                textAnchor="middle"
                dominantBaseline="hanging"
                fontFamily="ui-serif, Georgia, serif"
                fontSize={12}
                fill="#1a1a1a"
            >
                {dateStr}
            </text>
            {children}
        </g>
    );
}
