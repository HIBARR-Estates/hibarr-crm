import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDynamicTranslationContext } from "@/contexts/DynamicTranslationContext";
import {
    hashDynamicText,
    normalizeDynamicText,
} from "@/lib/dynamicTranslation";

const makeKey = (locale: string, hash: string) => ["dynTrans", locale, hash];

type DynamicTranslationResult = string | null;

export const useDynamicTranslation = (
    text: string | null | undefined,
): string => {
    const sourceText = text ?? "";
    const normalized = useMemo(
        () => (sourceText ? normalizeDynamicText(sourceText) : ""),
        [sourceText],
    );
    const hash = useMemo(
        () => (normalized ? hashDynamicText(sourceText) : ""),
        [normalized, sourceText],
    );

    const { locale, batcher } = useDynamicTranslationContext();
    const queryClient = useQueryClient();

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
        if (!sourceText || !normalized || !hash) {
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
    }, [batcher, locale, hash, normalized, queryClient, queryKey, sourceText]);

    return typeof query.data === "string" && query.data !== ""
        ? query.data
        : sourceText;
};

export const useDynamicTranslations = (
    texts: Array<string | null | undefined>,
): string[] => {
    const { locale, batcher } = useDynamicTranslationContext();
    const queryClient = useQueryClient();

    const entries = useMemo(
        () =>
            texts.map((value) => {
                const sourceText = value ?? "";
                const normalized = sourceText
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
        [texts, locale],
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
    }, [batcher, entries, locale, queryClient]);

    return entries.map((entry, index) => {
        const value = queries[index]?.data;
        return typeof value === "string" && value !== ""
            ? value
            : entry.sourceText;
    });
};

/**
 * Returns a `td(text)` function that can be called inline anywhere during
 * render — inside `.map()`, object literals, JSX attributes — just like `t()`
 * for static keys.
 *
 * On first call with a given text the original text is returned immediately
 * while a background translation is queued. When the translation arrives the
 * component re-renders automatically and subsequent `td(text)` calls return
 * the translated value.
 *
 * @example
 * const { td } = useTd();
 * // inside navItems build, JSX, anywhere during render:
 * label: td(pipeline.name)
 * <span>{td(deal.name)}</span>
 */
export const useTd = (): {
    td: (text: string | null | undefined) => string;
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

    const td = useCallback(
        (text: string | null | undefined): string => {
            const sourceText = text ?? "";
            if (!sourceText) return sourceText;

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
