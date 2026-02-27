/**
 * Build the invalidation mapping lazily so that Ziggy's route() is only
 * called at runtime (when a mutation fires), not at module-load time.
 */
export function getQueryInvalidation(): Record<
    string,
    (string | boolean | number)[][]
> {
    return {
        [route("deal-notes.store")]: [[route("deals.index")]],
        [route("meeting-types.store")]: [[route("meeting-types.index")]],
        [route("clients.store")]: [[route("clients.index")]],
    };
}
