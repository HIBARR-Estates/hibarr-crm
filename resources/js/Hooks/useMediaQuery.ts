import { useEffect, useState } from "react";

/**
 * Tracks a CSS media query in JS, for the rare cases where a component needs
 * to branch its rendered output (not just its styling) by viewport — pure
 * layout should still prefer Tailwind's responsive prefixes over this.
 */
export default function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => {
        if (typeof window === "undefined" || !window.matchMedia) {
            return false;
        }
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) {
            return;
        }
        const mql = window.matchMedia(query);
        const listener = () => setMatches(mql.matches);
        listener();
        mql.addEventListener("change", listener);
        return () => mql.removeEventListener("change", listener);
    }, [query]);

    return matches;
}

/** Tailwind's `lg` breakpoint (1024px) — the app's desktop/mobile-nav split. */
export function useIsDesktopViewport(): boolean {
    return useMediaQuery("(min-width: 1024px)");
}
