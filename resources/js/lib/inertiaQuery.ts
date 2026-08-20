import type { FormDataConvertible } from "@inertiajs/core";

/**
 * Read the current browser query string as a plain object.
 * Used so Inertia navigations (e.g. pagination) merge into existing
 * filter / sort / search params instead of replacing them.
 *
 * Inertia's `router.get` serializes array values as repeated `key[]=a&key[]=b`
 * pairs (qs `arrayFormat: "brackets"` — see @inertiajs/core's
 * `mergeDataIntoQueryString`). A naive `forEach` that does `params[key] =
 * value` collapses those repeats to just the last value, silently dropping
 * every other selection from a multi-select filter on the next merge (e.g.
 * changing page after picking 2+ statuses). Group by key first so repeats —
 * bracketed or not — come back as arrays.
 */
export function getCurrentQueryParams(): Record<string, FormDataConvertible> {
    const urlParams = new URLSearchParams(window.location.search);
    const seen = new Set<string>();
    const params: Record<string, FormDataConvertible> = {};

    urlParams.forEach((_value, rawKey) => {
        if (seen.has(rawKey)) return;
        seen.add(rawKey);

        const isBracketed = rawKey.endsWith("[]");
        const key = isBracketed ? rawKey.slice(0, -2) : rawKey;
        const values = urlParams.getAll(rawKey);

        params[key] = isBracketed || values.length > 1 ? values : values[0];
    });

    return params;
}

/**
 * Merge the current URL query with overrides (e.g. `{ page: 2 }`).
 * Override values win; empty string / null / undefined overrides remove the key.
 *
 * Return type matches Inertia `router.get` / `RequestPayload` (object form).
 */
export function mergeQueryParams(
    overrides: Record<string, FormDataConvertible>,
): Record<string, FormDataConvertible> {
    const params: Record<string, FormDataConvertible> = {
        ...getCurrentQueryParams(),
        ...overrides,
    };

    Object.keys(params).forEach((key) => {
        const value = params[key];
        if (value === null || value === undefined || value === "") {
            delete params[key];
        }
    });

    return params;
}
