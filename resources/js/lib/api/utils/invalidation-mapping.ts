export const QUERY_INVALIDATION: Record<
    string,
    (string | boolean | number)[][]
> = {
    [`${route("deal-notes.store")}`]: [[`${route("deals.show")}`]],
    [`${route("meeting-types.store")}`]: [[`${route("meeting-types.index")}`]],
};
