import { CSS_HEIGHT } from "./chartShared";

interface ChartPlaceholderProps {
    loading: boolean;
    error: string | null;
}

export default function ChartPlaceholder({ loading, error }: ChartPlaceholderProps) {
    const text = loading ? "Loading" : error;
    if (!text) return null;
    return (
        <div style={{
            height: CSS_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#888884",
            fontSize: "1rem",
        }}>
            {text}
        </div>
    );
}
