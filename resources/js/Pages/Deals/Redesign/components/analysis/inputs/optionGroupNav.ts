import type { KeyboardEvent } from "react";

/**
 * Left/Right arrow navigation between the options of a checkbox/radio group.
 *
 * The group must carry `data-option-group` so the modal's own Left/Right
 * section navigation stands down while focus is inside it.
 *
 * `onSelect` is for radio semantics, where moving focus also picks the option;
 * checkboxes pass nothing and stay on Space to toggle.
 */
export function handleOptionGroupArrows(
    e: KeyboardEvent<HTMLElement>,
    selector: string,
    onSelect?: (index: number) => void,
): boolean {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return false;

    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(selector));
    if (items.length === 0) return false;

    const active = document.activeElement;
    const current = items.findIndex((el) => el === active || el.contains(active));
    if (current === -1) return false;

    e.preventDefault();
    // Keep this key from also reaching the modal's section stepper.
    e.stopPropagation();

    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = (current + delta + items.length) % items.length;
    items[next].focus();
    onSelect?.(next);
    return true;
}
