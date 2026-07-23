import { useEffect, useRef, useState } from "react";

interface HScrollOverflow {
    left: boolean;
    right: boolean;
}

/** Ported from v2.2's useHScroll (deal-v2-2.jsx:678-695). */
export default function useHScroll() {
    const ref = useRef<HTMLDivElement>(null);
    const [overflow, setOverflow] = useState<HScrollOverflow>({
        left: false,
        right: false,
    });

    const update = () => {
        const el = ref.current;
        if (!el) return;
        const left = el.scrollLeft > 4;
        const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
        setOverflow((prev) =>
            prev.left === left && prev.right === right ? prev : { left, right },
        );
    };

    useEffect(() => {
        update();
    });

    useEffect(() => {
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    const nudge = (dir: 1 | -1) =>
        ref.current?.scrollBy({ left: dir * 220, behavior: "smooth" });

    return { ref, overflow, update, nudge };
}
