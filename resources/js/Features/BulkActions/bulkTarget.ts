/**
 * How a bulk action should resolve its target rows.
 * - ids: explicit checkbox selection
 * - all_matching: every row in the current filtered index list
 */
export type BulkTarget =
    | { mode: "ids"; ids: number[]; count: number }
    | { mode: "all_matching"; count: number };

/** Filter/search scope echoed in all-matching bulk POST bodies. */
export type BulkFilterScope = Record<string, unknown>;

export function buildBulkFilterScope(
    filters: Record<string, unknown> | undefined,
): BulkFilterScope {
    if (!filters) {
        return {};
    }

    const scope: BulkFilterScope = {};
    const keys = [
        "status",
        "priority",
        "assigned_to",
        "assigned_by",
        "project_id",
        "category_id",
        "labels",
        "due_date_range",
        "due_start_date",
        "due_end_date",
        "created_date_range",
        "created_start_date",
        "created_end_date",
        "search",
        "quick_filter",
    ] as const;

    for (const key of keys) {
        const value = filters[key];
        if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !(Array.isArray(value) && value.length === 0)
        ) {
            scope[key] = value;
        }
    }

    return scope;
}

export function buildBulkTargetPayload(
    target: BulkTarget,
    filterScope?: BulkFilterScope,
): Record<string, unknown> {
    if (target.mode === "all_matching") {
        return { select_all_matching: true, ...filterScope };
    }

    return { row_ids: target.ids.join(",") };
}
