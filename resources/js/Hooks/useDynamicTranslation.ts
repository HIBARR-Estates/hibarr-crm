import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDynamicTranslationContext } from "@/contexts/DynamicTranslationContext";
import {
    hashDynamicText,
    normalizeDynamicText,
    shouldRequestDynamicTranslation,
    type DynamicTranslationOptions,
    type TdFn,
} from "@/lib/dynamicTranslation";

export const makeDynamicTranslationKey = (locale: string, hash: string) => [
    "dynTrans",
    locale,
    hash,
];
const makeKey = makeDynamicTranslationKey;

type DynamicTranslationResult = string | null;

export const useDynamicTranslation = (
    text: string | null | undefined,
    options?: DynamicTranslationOptions,
): string => {
    const sourceText = text ?? "";
    const { locale, batcher } = useDynamicTranslationContext();
    const queryClient = useQueryClient();

    const shouldTranslate = shouldRequestDynamicTranslation(locale, options);

    const normalized = useMemo(
        () =>
            sourceText && shouldTranslate
                ? normalizeDynamicText(sourceText)
                : "",
        [sourceText, shouldTranslate],
    );
    const hash = useMemo(
        () => (normalized ? hashDynamicText(sourceText) : ""),
        [normalized, sourceText],
    );

    const queryKey = useMemo(
        () => (hash ? makeKey(locale, hash) : ["dynTrans", locale, "empty"]),
        [locale, hash],
    );

    const query = useQuery<DynamicTranslationResult>({
        queryKey,
        enabled: false,
        queryFn: async () => null,
        initialData: null,
        staleTime: 30_000,
    });

    useEffect(() => {
        if (!shouldTranslate || !sourceText || !normalized || !hash) {
            return;
        }

        const current =
            queryClient.getQueryData<DynamicTranslationResult>(queryKey);

        if (typeof current === "string" && current !== "") {
            return;
        }

        const unsubscribe = batcher.subscribe({
            locale,
            hash,
            text: sourceText,
            listener: (value) => {
                if (typeof value === "string" && value !== "") {
                    queryClient.setQueryData(queryKey, value);
                }
            },
        });

        return unsubscribe;
    }, [
        batcher,
        locale,
        hash,
        normalized,
        queryClient,
        queryKey,
        sourceText,
        shouldTranslate,
    ]);

    if (!shouldTranslate) {
        return sourceText;
    }

    return typeof query.data === "string" && query.data !== ""
        ? query.data
        : sourceText;
};

export const useDynamicTranslations = (
    texts: Array<string | null | undefined>,
    options?: DynamicTranslationOptions,
): string[] => {
    const { locale, batcher } = useDynamicTranslationContext();
    const queryClient = useQueryClient();
    const shouldTranslate = shouldRequestDynamicTranslation(locale, options);

    const entries = useMemo(
        () =>
            texts.map((value) => {
                const sourceText = value ?? "";
                const normalized =
                    sourceText && shouldTranslate
                        ? normalizeDynamicText(sourceText)
                        : "";
                const hash = normalized ? hashDynamicText(sourceText) : "";

                return {
                    sourceText,
                    normalized,
                    hash,
                    queryKey: hash
                        ? makeKey(locale, hash)
                        : (["dynTrans", locale, "empty"] as const),
                };
            }),
        [texts, locale, shouldTranslate],
    );

    const queries = useQueries({
        queries: entries.map((entry) => ({
            queryKey: entry.queryKey,
            enabled: false,
            queryFn: async () => null as DynamicTranslationResult,
            initialData: null as DynamicTranslationResult,
            staleTime: 30_000,
        })),
    });

    useEffect(() => {
        if (!shouldTranslate) {
            return;
        }

        const unsubscribers: Array<() => void> = [];

        entries.forEach((entry) => {
            if (!entry.sourceText || !entry.normalized || !entry.hash) {
                return;
            }

            const current = queryClient.getQueryData<DynamicTranslationResult>(
                entry.queryKey,
            );

            if (typeof current === "string" && current !== "") {
                return;
            }

            const unsubscribe = batcher.subscribe({
                locale,
                hash: entry.hash,
                text: entry.sourceText,
                listener: (value) => {
                    if (typeof value === "string" && value !== "") {
                        queryClient.setQueryData(entry.queryKey, value);
                    }
                },
            });

            unsubscribers.push(unsubscribe);
        });

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [batcher, entries, locale, queryClient, shouldTranslate]);

    if (!shouldTranslate) {
        return entries.map((entry) => entry.sourceText);
    }

    return entries.map((entry, index) => {
        const value = queries[index]?.data;
        return typeof value === "string" && value !== ""
            ? value
            : entry.sourceText;
    });
};

/**
 * True while any `td`/`useDynamicTranslation` text for the surrounding
 * provider's locale is still being fetched or waiting on a queued translation.
 * Always false for English (nothing is ever requested).
 */
export const useDynamicTranslationPending = (): boolean => {
    const { locale, batcher } = useDynamicTranslationContext();
    const [pending, setPending] = useState(false);

    useEffect(() => {
        if (locale === "en") {
            setPending(false);
            return;
        }

        return batcher.subscribeActivity(locale, setPending);
    }, [batcher, locale]);

    return pending;
};

/**
 * Returns a `td(text, options?)` function that can be called inline anywhere
 * during render — inside `.map()`, object literals, JSX attributes — just like
 * `t()` for static keys.
 *
 * Only translates when `options.source === "en"` **and** the user locale is not
 * English. English locales always get the original string (no batch, no rewrite).
 * Omit `source` for free-form / non-English-source content so it is never
 * dictionary-translated.
 *
 * @example
 * const { td } = useTd();
 * label: td(pipeline.name, { source: "en" })
 * <span>{td(deal.name)}</span> // UGC — identity
 */
export const useTd = (): {
    td: TdFn;
} => {
    const { locale, batcher } = useDynamicTranslationContext();
    const queryClient = useQueryClient();

    // A cheap counter used to force a re-render when translations arrive.
    const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

    // Track which (locale, hash) pairs this component instance has already
    // subscribed to so we never double-subscribe.
    const subscribedRef = useRef<Set<string>>(new Set());
    const unsubscribersRef = useRef<Map<string, () => void>>(new Map());

    // When locale changes, drop all existing subscriptions — they belong to
    // the old locale. New ones will be created on the next render.
    useEffect(() => {
        unsubscribersRef.current.forEach((unsub) => unsub());
        unsubscribersRef.current.clear();
        subscribedRef.current.clear();
    }, [locale]);

    // Cleanup on unmount.
    useEffect(() => {
        return () => {
            unsubscribersRef.current.forEach((unsub) => unsub());
            unsubscribersRef.current.clear();
            subscribedRef.current.clear();
        };
    }, []);

    const td = useCallback<TdFn>(
        (text, options) => {
            const sourceText = text ?? "";
            if (!sourceText) return sourceText;

            if (!shouldRequestDynamicTranslation(locale, options)) {
                return sourceText;
            }

            const hash = hashDynamicText(sourceText);
            const queryKey = makeKey(locale, hash);

            // Synchronous cache check — returns translated text if already known.
            const cached =
                queryClient.getQueryData<DynamicTranslationResult>(queryKey);
            if (typeof cached === "string" && cached !== "") {
                return cached;
            }

            // Subscribe once per (locale, hash) per component instance.
            const subscriptionKey = `${locale}:${hash}`;
            if (!subscribedRef.current.has(subscriptionKey)) {
                subscribedRef.current.add(subscriptionKey);

                const unsub = batcher.subscribe({
                    locale,
                    hash,
                    text: sourceText,
                    listener: (value) => {
                        if (typeof value === "string" && value !== "") {
                            queryClient.setQueryData(queryKey, value);
                            // Trigger re-render so the next td() call sees
                            // the translated value from the cache.
                            forceUpdate();
                        }
                    },
                });

                unsubscribersRef.current.set(subscriptionKey, unsub);
            }

            // Fallback: return the original text until the translation arrives.
            return sourceText;
        },
        // forceUpdate is stable (from useReducer); locale/batcher/queryClient
        // are stable within a locale lifetime — safe deps.
        [batcher, locale, queryClient],
    );

    return { td };
};

export type { DynamicTranslationOptions, TdFn };
