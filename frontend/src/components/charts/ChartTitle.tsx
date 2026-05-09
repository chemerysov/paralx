import type { ReactNode } from "react";
import Katex from "../Katex";

interface ChartTitleProps {
    children: ReactNode;
    formula?: string;
}

export default function ChartTitle({ children, formula }: ChartTitleProps) {
    return (
        <p style={{
            margin: "0 0 8px 0",
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: "1rem",
            fontWeight: 700,
            color: "#1a1a1a",
            textAlign: "center",
            textWrap: "balance",
        }}>
            {children}
            {formula && <> <Katex formula={formula} display={false} /></>}
        </p>
    );
}
