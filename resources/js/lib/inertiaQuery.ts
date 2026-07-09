/**
 * Read the current browser query string as a plain object.
 * Used so Inertia navigations (e.g. pagination) merge into existing
 * filter / sort / search params instead of replacing them.
 */
export function getCurrentQueryParams(): Record<string, string> {
    const urlParams = new URLSearchParams(window.location.search);
    const params: Record<string, string> = {};
    urlParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

/**
 * Merge the current URL query with overrides (e.g. `{ page: 2 }`).
 * Override values win; empty string / null / undefined overrides remove the key.
 */
export function mergeQueryParams(
    overrides: Record<string, unknown>,
): Record<string, unknown> {
    const params: Record<string, unknown> = {
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
