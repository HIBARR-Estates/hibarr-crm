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

class DynamicTranslationBatcher {
    private flushDelayMs: number;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private pending: Map<string, PendingLocaleMap> = new Map();
    private listeners: Map<string, Set<Listener>> = new Map();

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
        listeners.add(listener);
        this.listeners.set(key, listeners);

        const localePending = this.pending.get(locale) ?? new Map<string, string>();

        if (!localePending.has(hash)) {
            localePending.set(hash, text);
            this.pending.set(locale, localePending);
        }

        this.scheduleFlush();

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

        await Promise.all(
            Array.from(pendingSnapshot.entries()).map(async ([locale, items]) => {
                const payloadItems = Array.from(items.entries()).map(([hash, text]) => ({
                    hash,
                    text,
                }));

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

                    for (const [hash] of items) {
                        const value =
                            typeof translations[hash] === "string"
                                ? (translations[hash] as string)
                                : null;
                        this.emit(locale, hash, value);
                    }
                } catch (_error) {
                    for (const [hash] of items) {
                        this.emit(locale, hash, null);
                    }
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
