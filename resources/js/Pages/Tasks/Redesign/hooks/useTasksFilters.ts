import { useCallback, useMemo } from "react";
import { router } from "@inertiajs/react";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import type { FormDataConvertible } from "@inertiajs/core";

export interface TasksFilterState {
    status?: string | string[];
    priority?: string | string[];
    assigned_to?: number | string | Array<number | string>;
    assigned_by?: number | string | Array<number | string>;
    category_id?: number | string | Array<number | string>;
    due_date_range?: string | string[];
    search?: string;
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

/**
 * URL-synced task filters — same server round-trip the legacy Tasks/Index
 * already uses (`TaskController::index()` reads these off the request), just
 * driven from the redesign's pill/chip UI instead of the antd filter drawer.
 */
export default function useTasksFilters(filters: TasksFilterState) {
    /** Total selected values across every dimension (the Filters badge). */
    const activeCount = useMemo(
        () =>
            Object.entries(filters).reduce((total, [key, value]) => {
                // A due range is one filter, not two endpoints.
                if (key === "due_date_range") {
                    return total + (hasFilter(value) ? 1 : 0);
                }
                return total + appliedValues(value).length;
            }, 0),
        [filters],
    );

    const applyFilters = useCallback(
        (overrides: Record<string, FormDataConvertible>) => {
            router.get(route("tasks.index"), mergeQueryParams(overrides), {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        },
        [],
    );

    const clearAll = useCallback(() => {
        router.get(
            route("tasks.index"),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }, []);

    return { filters, activeCount, applyFilters, clearAll };
}
