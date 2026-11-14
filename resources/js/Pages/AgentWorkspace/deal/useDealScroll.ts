import { useEffect, useState, type RefObject } from "react";

/** The dock's own height on a wide screen; on a phone nothing but the pinned bar overlays the page. */
function chromeOffset(): number {
    if (typeof window === "undefined" || !window.matchMedia("(min-width: 1024px)").matches) return 0;
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--agent-chrome-bottom");
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : 116;
}

/**
 * True once the element has scrolled up under the dock. The page's own header
 * hands over to the compact bar at that point (canvas L7-11).
 */
export function useScrolledPast(ref: RefObject<HTMLElement | null>): boolean {
    const [past, setPast] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(
            ([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.bottom <= chromeOffset() + 1),
            { rootMargin: `-${chromeOffset()}px 0px 0px 0px`, threshold: 0 },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);

    return past;
}

/**
 * The section the page is reading: the first of `ids`, in page order, that is
 * in the upper part of the screen below the pinned chrome.
 */
export function useSectionSpy(ids: string[], enabled: boolean): [string | null, (id: string) => void] {
    const [active, setActive] = useState<string | null>(ids[0] ?? null);
    const key = ids.join("|");

    useEffect(() => {
        if (!enabled || typeof IntersectionObserver === "undefined") return;
        const visible = new Set<string>();
        // Pinned chrome is about 260px tall on a wide screen, 130px on a phone.
        const top = chromeOffset() > 0 ? 270 : 130;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target.id);
                    else visible.delete(entry.target.id);
                }
                const first = ids.find((id) => visible.has(id));
                if (first) setActive(first);
            },
            { rootMargin: `-${top}px 0px -45% 0px`, threshold: 0 },
        );
        for (const id of ids) {
            const element = document.getElementById(id);
            if (element) observer.observe(element);
        }
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, enabled]);

    return [active, setActive];
}

/** Scrolls a section to just under the pinned chrome. */
export function scrollToSection(id: string): void {
    const element = document.getElementById(id);
    if (!element) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
