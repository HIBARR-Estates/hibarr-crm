import { RefObject, useLayoutEffect, useState } from "react";

interface FloatingMenuOptions {
    align?: "left" | "right";
    gap?: number;
    maxHeight?: number;
    /**
     * Must sit above portaled redesign modals (deal-redesign overlay is 1300).
     * Default 1500 so MenuSelect / pickers remain visible inside modals.
     */
    zIndex?: number;
}

interface FloatingMenuStyle {
    position: "fixed";
    zIndex: number;
    maxHeight: number;
    top: number | "auto";
    bottom: number | "auto";
    left: number | "auto";
    right: number | "auto";
}

/**
 * Positions a portal-rendered menu relative to its trigger using fixed
 * coordinates instead of `position: absolute`, so an open menu never grows
 * an ancestor's scrollHeight (e.g. the sticky sidebar rail). Flips upward
 * when there isn't enough room below the trigger.
 */
export default function useFloatingMenuPosition(
    open: boolean,
    triggerRef: RefObject<HTMLElement | null>,
    {
        align = "left",
        gap = 6,
        maxHeight = 260,
        zIndex = 1500,
    }: FloatingMenuOptions = {},
): FloatingMenuStyle | null {
    const [style, setStyle] = useState<FloatingMenuStyle | null>(null);

    useLayoutEffect(() => {
        if (!open || !triggerRef.current) {
            setStyle(null);
            return undefined;
        }

        const update = () => {
            const el = triggerRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const spaceBelow = vh - r.bottom - gap;
            const spaceAbove = r.top - gap;
            const openUp =
                spaceBelow < Math.min(maxHeight, 160) && spaceAbove > spaceBelow;

            const next: FloatingMenuStyle = {
                position: "fixed",
                zIndex,
                // Cap at the caller's requested height — without the Math.min
                // the menu grows to fill all available viewport space, which
                // makes long option lists (e.g. lead fields) run the full page.
                maxHeight: Math.min(
                    maxHeight,
                    Math.max(120, openUp ? spaceAbove : spaceBelow),
                ),
                top: "auto",
                bottom: "auto",
                left: "auto",
                right: "auto",
            };
            if (openUp) next.bottom = vh - r.top + gap;
            else next.top = r.bottom + gap;
            if (align === "right") next.right = Math.max(8, vw - r.right);
            else next.left = Math.max(8, r.left);
            setStyle(next);
        };

        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [open, triggerRef, align, gap, maxHeight, zIndex]);

    return style;
}
