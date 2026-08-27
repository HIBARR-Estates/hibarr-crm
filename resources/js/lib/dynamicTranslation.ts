import axios from "axios";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export type DynamicTranslationValue = string | null;

/**
 * Opt-in: text is stable English source (UI literals, lookup-table values).
 * Without this, `td` is a no-op (identity) so UGC is never dictionary-translated.
 */
export type DynamicTranslationOptions = {
    source?: "en";
};

export type TdFn = (
    text: string | null | undefined,
    options?: DynamicTranslationOptions,
) => string;

/** No-op `td` for components that accept an optional translator prop. */
export const identityTd: TdFn = (text) => text ?? "";

type Listener = (value: DynamicTranslationValue) => void;

type PendingLocaleMap = Map<string, string>;

interface BatchResponse {
    success: boolean;
    data?: {
        locale?: string;
        translations?: Record<string, DynamicTranslationValue>;
        queued?: number;
    };
}

export const DYNAMIC_TRANSLATION_BATCH_ENDPOINT =
    "/account/api/dynamic-translations/batch";

/** Trim + collapse whitespace only — case-preserving so display casing is stable. */
export const normalizeDynamicText = (text: string): string => {
    return text.trim().replace(/\s+/g, " ");
};

export const hashDynamicText = (text: string): string => {
    const normalized = normalizeDynamicText(text);
    return bytesToHex(sha256(utf8ToBytes(normalized)));
};

/** Only English product/lookup source is eligible for non-English locales. */
export const shouldRequestDynamicTranslation = (
    locale: string,
    options?: DynamicTranslationOptions,
): boolean => {
    if (!locale || locale === "en") {
        return false;
    }

    return options?.source === "en";
};

/**
 * A miss queues a background translation job. Those take a queue hop plus one
 * API call per target locale — measured at 1-2 minutes under load — so poll
 * with backoff for ~5 minutes before giving up on the source text.
 */
/** Server-side cap on `items` per batch call. */
const MAX_BATCH_ITEMS = 500;

const RETRY_BASE_DELAY_MS = 2000;
const RETRY_MAX_DELAY_MS = 15000;
const MAX_RETRIES = 25;

const retryDelayMs = (attempt: number): number =>
    Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));

type ActivityListener = (active: boolean) => void;

class DynamicTranslationBatcher {
    private flushDelayMs: number;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private pending: Map<string, PendingLocaleMap> = new Map();
    private listeners: Map<string, Set<Listener>> = new Map();
    private inFlight: Map<string, number> = new Map();
    private retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private retryCounts: Map<string, number> = new Map();
    private activityListeners: Map<string, Set<ActivityListener>> = new Map();

    constructor(flushDelayMs = 50) {
        this.flushDelayMs = flushDelayMs;
    }

    subscribe(input: {
        locale: string;
        hash: string;
        text: string;
        listener: Listener;
    }): () => void {
        const { locale, hash, text, listener } = input;
        const key = this.toListenerKey(locale, hash);

        const listeners = this.listeners.get(key) ?? new Set<Listener>();
        // Fresh interest in a hash nobody is polling for — allow a new retry run.
        if (listeners.size === 0 && !this.retryTimers.has(key)) {
            this.retryCounts.delete(key);
        }
        listeners.add(listener);
        this.listeners.set(key, listeners);

        const localePending = this.pending.get(locale) ?? new Map<string, string>();

        if (!localePending.has(hash)) {
            localePending.set(hash, text);
            this.pending.set(locale, localePending);
        }

        this.scheduleFlush();
        this.notifyActivity(locale);

        return () => {
            const current = this.listeners.get(key);
            if (!current) {
                return;
            }

            current.delete(listener);
            if (current.size === 0) {
                this.listeners.delete(key);
            }
        };
    }

    /**
     * Queue translation of text nobody is displaying yet, so the jobs are done
     * by the time it renders. No listeners, so misses are not retried — the
     * component that eventually shows the text does that.
     */
    warm(locale: string, texts: Array<string | null | undefined>): void {
        if (!locale || locale === "en") {
            return;
        }

        const localePending =
            this.pending.get(locale) ?? new Map<string, string>();

        for (const text of texts) {
            if (!text || normalizeDynamicText(text) === "") {
                continue;
            }

            const hash = hashDynamicText(text);
            if (!localePending.has(hash)) {
                localePending.set(hash, text);
            }
        }

        if (localePending.size === 0) {
            return;
        }

        this.pending.set(locale, localePending);
        this.scheduleFlush();
        this.notifyActivity(locale);
    }

    /** Notifies whether any text for `locale` is still being fetched or queued. */
    subscribeActivity(locale: string, listener: ActivityListener): () => void {
        const listeners =
            this.activityListeners.get(locale) ?? new Set<ActivityListener>();
        listeners.add(listener);
        this.activityListeners.set(locale, listeners);
        listener(this.isActive(locale));

        return () => {
            const current = this.activityListeners.get(locale);
            if (!current) {
                return;
            }

            current.delete(listener);
            if (current.size === 0) {
                this.activityListeners.delete(locale);
            }
        };
    }

    /**
     * Stops polling for `locale` — clears anything not yet flushed and any
     * scheduled retries, then reports "not active" immediately. Used when a
     * caller (e.g. a "continue anyway" escape hatch) opts out of waiting;
     * whatever is already cached stays translated, the rest keeps showing
     * its English fallback. A request already in flight can't be aborted
     * here, but it just updates the cache harmlessly if it lands.
     */
    cancelPending(locale: string): void {
        this.pending.delete(locale);

        const prefix = `${locale}:`;
        for (const key of Array.from(this.retryTimers.keys())) {
            if (!key.startsWith(prefix)) {
                continue;
            }

            clearTimeout(this.retryTimers.get(key));
            this.retryTimers.delete(key);
            this.retryCounts.delete(key);
        }

        this.notifyActivity(locale);
    }

    private isActive(locale: string): boolean {
        if ((this.pending.get(locale)?.size ?? 0) > 0) {
            return true;
        }

        if ((this.inFlight.get(locale) ?? 0) > 0) {
            return true;
        }

        const prefix = `${locale}:`;
        for (const key of this.retryTimers.keys()) {
            if (key.startsWith(prefix)) {
                return true;
            }
        }

        return false;
    }

    private notifyActivity(locale: string): void {
        const listeners = this.activityListeners.get(locale);

        if (!listeners || listeners.size === 0) {
            return;
        }

        const active = this.isActive(locale);
        listeners.forEach((listener) => listener(active));
    }

    private scheduleRetry(locale: string, hash: string, text: string): void {
        const key = this.toListenerKey(locale, hash);

        if (!this.listeners.get(key)?.size || this.retryTimers.has(key)) {
            return;
        }

        const attempt = (this.retryCounts.get(key) ?? 0) + 1;
        if (attempt > MAX_RETRIES) {
            return;
        }
        this.retryCounts.set(key, attempt);

        this.retryTimers.set(
            key,
            setTimeout(() => {
                this.retryTimers.delete(key);

                if (!this.listeners.get(key)?.size) {
                    this.notifyActivity(locale);
                    return;
                }

                const localePending =
                    this.pending.get(locale) ?? new Map<string, string>();
                localePending.set(hash, text);
                this.pending.set(locale, localePending);
                this.scheduleFlush();
            }, retryDelayMs(attempt)),
        );
    }

    private scheduleFlush(): void {
        if (this.timer) {
            return;
        }

        this.timer = setTimeout(() => {
            this.timer = null;
            void this.flush();
        }, this.flushDelayMs);
    }

    private async flush(): Promise<void> {
        if (this.pending.size === 0) {
            return;
        }

        const pendingSnapshot = this.pending;
        this.pending = new Map();

        const chunks: Array<[string, PendingLocaleMap]> = [];
        for (const [locale, items] of pendingSnapshot.entries()) {
            // The endpoint rejects more than 500 items per call.
            const entries = Array.from(items.entries());
            for (let i = 0; i < entries.length; i += MAX_BATCH_ITEMS) {
                chunks.push([locale, new Map(entries.slice(i, i + MAX_BATCH_ITEMS))]);
            }
        }

        await Promise.all(
            chunks.map(async ([locale, items]) => {
                const payloadItems = Array.from(items.entries()).map(([hash, text]) => ({
                    hash,
                    text,
                }));

                this.inFlight.set(locale, (this.inFlight.get(locale) ?? 0) + 1);
                this.notifyActivity(locale);

                try {
                    const response = await axios.post<BatchResponse>(
                        DYNAMIC_TRANSLATION_BATCH_ENDPOINT,
                        {
                            locale,
                            items: payloadItems,
                        },
                        {
                            headers: {
                                Accept: "application/json",
                            },
                        },
                    );

                    const translations = response.data?.data?.translations ?? {};

                    for (const [hash, text] of items) {
                        const value =
                            typeof translations[hash] === "string"
                                ? (translations[hash] as string)
                                : null;

                        if (value === null) {
                            this.scheduleRetry(locale, hash, text);
                            continue;
                        }

                        this.retryCounts.delete(this.toListenerKey(locale, hash));
                        this.emit(locale, hash, value);
                    }
                } catch (_error) {
                    for (const [hash] of items) {
                        this.emit(locale, hash, null);
                    }
                } finally {
                    this.inFlight.set(
                        locale,
                        Math.max(0, (this.inFlight.get(locale) ?? 1) - 1),
                    );
                    this.notifyActivity(locale);
                }
            }),
        );
    }

    private emit(locale: string, hash: string, value: DynamicTranslationValue): void {
        const key = this.toListenerKey(locale, hash);
        const listeners = this.listeners.get(key);

        if (!listeners || listeners.size === 0) {
            return;
        }

        listeners.forEach((listener) => {
            listener(value);
        });
    }

    private toListenerKey(locale: string, hash: string): string {
        return `${locale}:${hash}`;
    }
}

export const dynamicTranslationBatcher = new DynamicTranslationBatcher();
