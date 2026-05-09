import { useEffect, useRef, useState } from "react";

export function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

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

    return [containerRef, width];
}
