import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";

/** What the list itself needs: the rows and the filters that produced them. */
const LIST_KEYS = ["leads", "filters"];

/**
 * Everything a list visit refreshes, for visits that do not go through
 * usePeopleList (the filter modal): the deferred groups are evaluated in the
 * same response there, which is fine behind a modal's Apply.
 */
export const PEOPLE_RELOAD_KEYS = [...LIST_KEYS, "counts", "rowExtras", "savedViews"];

type Value = string | number | null | undefined;

/** The query string of an Inertia page url ("/agent/people?x=1") as plain values. */
export function queryOf(url: string): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(url.split("?")[1] ?? ""));
}

/**
 * Moves the list (chip, search, sort, page, view) with a partial Inertia
 * visit: the page keeps its state and scroll, and the URL carries the result
 * so a link or a reload lands in the same place. The visit fetches only the
 * rows; the counts and each row's deals and last touch follow in a second,
 * background request, so the list never waits on them. `busy` is true while
 * the rows are in flight so the table can dim instead of blanking.
 *
 * `url` is the page's current url. The hook keeps the latest requested query
 * itself, so a control used while an earlier visit is still pending builds on
 * that request rather than on the older url; it re-reads the url whenever it
 * changes (a view, the filter modal).
 */
export default function usePeopleList(url: string) {
    const [busy, setBusy] = useState(false);
    const query = useRef<Record<string, string>>(queryOf(url));
    const background = useRef<{ cancel: () => void } | null>(null);

    useEffect(() => {
        query.current = queryOf(url);
    }, [url]);

    const visit = useCallback((changes: Record<string, Value>, options: { replaceAll?: boolean } = {}) => {
        const params: Record<string, string> = options.replaceAll ? {} : { ...query.current };
        for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === undefined || value === "") delete params[key];
            else params[key] = String(value);
        }
        // Anything but a page change starts again from the first page.
        if (!("page" in changes)) delete params.page;
        query.current = params;

        // A counts/extras request for the previous query must not land on this one.
        background.current?.cancel();
        background.current = null;

        router.get(route("agent.people"), params, {
            only: LIST_KEYS,
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
            onSuccess: () => {
                // Counts ignore the page, so paging leaves them as they are.
                const extras = "page" in changes ? ["rowExtras"] : ["counts", "rowExtras"];
                router.reload({
                    only: extras,
                    onCancelToken: (token) => {
                        background.current = token;
                    },
                });
            },
        });
    }, []);

    return { visit, busy };
}

/**
 * The search box's text, sent to the list once typing pauses. It follows the
 * URL's `search` when something else changes it (the filter modal, a view).
 */
export function useListSearch(applied: string, onSearch: (query: string) => void, delay = 300) {
    const [text, setText] = useState(applied);
    const sent = useRef(applied);

    useEffect(() => {
        if (applied !== sent.current) {
            sent.current = applied;
            setText(applied);
        }
    }, [applied]);

    useEffect(() => {
        const next = text.trim();
        if (next === sent.current) return;
        const handle = window.setTimeout(() => {
            sent.current = next;
            onSearch(next);
        }, delay);
        return () => window.clearTimeout(handle);
    }, [text, delay, onSearch]);

    return { text, setText };
}
