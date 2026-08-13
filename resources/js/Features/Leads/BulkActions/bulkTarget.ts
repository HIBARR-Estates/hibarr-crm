/**
 * How a bulk action should resolve its target leads.
 * - ids: explicit checkbox selection
 * - all_matching: every lead in the current filtered index list
 */
export type LeadBulkTarget =
    | { mode: "ids"; ids: number[]; count: number }
    | { mode: "all_matching"; count: number };

export function buildBulkTargetPayload(
    target: LeadBulkTarget,
): Record<string, unknown> {
    if (target.mode === "all_matching") {
        return { select_all_matching: true };
    }

    return { row_ids: target.ids.join(",") };
}
