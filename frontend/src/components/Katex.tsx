import katex from "katex";
import "katex/dist/katex.min.css";

interface Props {
    formula: string;
    display?: boolean;
}

export default function Katex({ formula, display = false }: Props) {
    const html = katex.renderToString(formula, {
        displayMode: display,
        throwOnError: false,
    });
    return (
        <span
            className={display ? "math-display" : "math-inline"}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
