import type { ColumnsType } from "antd/lib/table";
import type { Breakpoint } from "antd";

const HIDDEN_BELOW_LG: Breakpoint[] = ["lg"];

/**
 * Marks the given column keys as hidden below Ant Design's `lg` breakpoint
 * (1024px) — Ant's built-in `responsive` column option, which only affects
 * visibility below that breakpoint and never changes desktop rendering.
 *
 * When `enabled` is false the columns are returned unchanged, so callers can
 * gate this behind a feature flag while it's being staged.
 */
export function withMobileResponsiveColumns<T>(
    columns: ColumnsType<T>,
    hiddenBelowLgKeys: string[],
    enabled: boolean,
): ColumnsType<T> {
    if (!enabled) return columns;

    return columns.map((col) => {
        if ("key" in col && col.key && hiddenBelowLgKeys.includes(String(col.key))) {
            return { ...col, responsive: HIDDEN_BELOW_LG };
        }
        return col;
    });
}

/**
 * Builds a display list of page numbers with "ellipsis" placeholders.
 *
 * Always surfaces the first and last pages, shows a window of `maxVisible`
 * consecutive pages centred on `current`, and inserts ellipsis markers
 * wherever there is a gap in the sequence.
 */
export function buildPageRange(
    current: number,
    total: number,
    maxVisible = 5,
): (number | "ellipsis")[] {
    if (total <= 0) return [];
    if (total <= maxVisible) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [];
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total, start + maxVisible - 1);

    // Clamp the window so it never undershoots maxVisible items.
    if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push("ellipsis");
    }

    for (let i = start; i <= end; i++) {
        pages.push(i);
    }

    if (end < total) {
        if (end < total - 1) pages.push("ellipsis");
        pages.push(total);
    }

    return pages;
}
