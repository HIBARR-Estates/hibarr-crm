/**
 * How a bulk action should resolve its target rows.
 * - ids: explicit checkbox selection
 * - all_matching: every row in the current filtered index list
 */
export type BulkTarget =
    | { mode: "ids"; ids: number[]; count: number }
    | { mode: "all_matching"; count: number };

export function buildBulkTargetPayload(
    target: BulkTarget,
): Record<string, unknown> {
    if (target.mode === "all_matching") {
        return { select_all_matching: true };
    }

    return { row_ids: target.ids.join(",") };
}
