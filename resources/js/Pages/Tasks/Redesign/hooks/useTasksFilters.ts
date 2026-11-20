import { useMemo } from "react";

export interface TasksFilterState {
    status?: string | string[];
    priority?: string | string[];
    assigned_to?: number | string | Array<number | string>;
    assigned_by?: number | string | Array<number | string>;
    category_id?: number | string | Array<number | string>;
    labels?: number | string | Array<number | string>;
    project_id?: number | string | null;
    due_date_range?: string | string[];
    due_start_date?: string;
    due_end_date?: string;
    created_date_range?: string | string[];
    created_start_date?: string;
    created_end_date?: string;
    search?: string;
    /** `<key>_mode`: "not_in" | "empty" | "any" — see ExclusionMode. */
    status_mode?: string;
    priority_mode?: string;
    assigned_to_mode?: string;
    assigned_by_mode?: string;
    category_id_mode?: string;
    labels_mode?: string;
    project_id_mode?: string;
    due_date_range_mode?: string;
}

/**
 * Normalises a filter value to a list of applied values.
 *
 * `TaskController@index` always echoes the multi-select filters back, sending
 * `[]` when nothing is applied — and an empty array is truthy in JS, so every
 * caller must go through this rather than testing the value directly.
 */
export function appliedValues(value: unknown): string[] {
    if (value === null || value === undefined || value === "") return [];
    const list = Array.isArray(value) ? value : [value];
    return list
        .filter((item) => item !== null && item !== undefined && item !== "")
        .map((item) => String(item));
}

/** True when a filter value carries at least one applied selection. */
export function hasFilter(value: unknown): boolean {
    return appliedValues(value).length > 0;
}

/** "Is empty" / "Has any" carry no values, so they count as one selection themselves. */
const isValueless = (mode: unknown): boolean =>
    mode === "empty" || mode === "any";

/**
 * Task filter badge count — filter application itself goes through
 * `FilterContext`/`taskFilterConfig`, this hook just counts active
 * selections for the "Filters (N)" badge.
 */
export default function useTasksFilters(filters: TasksFilterState) {
    /** Total selected values across every dimension (the Filters badge). */
    const activeCount = useMemo(() => {
        let total = 0;

        const counted = (value: unknown, mode: unknown) =>
            isValueless(mode) ? 1 : appliedValues(value).length;

        total += counted(filters.status, filters.status_mode);
        total += counted(filters.priority, filters.priority_mode);
        total += counted(filters.assigned_to, filters.assigned_to_mode);
        total += counted(filters.assigned_by, filters.assigned_by_mode);
        total += counted(filters.category_id, filters.category_id_mode);
        total += counted(filters.labels, filters.labels_mode);

        if (
            isValueless(filters.project_id_mode) ||
            (filters.project_id != null &&
                filters.project_id !== "" &&
                filters.project_id !== "all")
        ) {
            total += 1;
        }

        if (hasFilter(filters.search)) {
            total += 1;
        }

        if (
            isValueless(filters.due_date_range_mode) ||
            hasFilter(filters.due_date_range) ||
            hasFilter(filters.due_start_date) ||
            hasFilter(filters.due_end_date)
        ) {
            total += 1;
        }

        if (
            hasFilter(filters.created_date_range) ||
            hasFilter(filters.created_start_date) ||
            hasFilter(filters.created_end_date)
        ) {
            total += 1;
        }

        return total;
    }, [filters]);

    return { filters, activeCount };
}
