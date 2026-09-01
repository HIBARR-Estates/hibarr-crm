import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";

/**
 * Kill-switch for the coalesced custom-field save path below. Off: every
 * key (custom field or not) keeps its own independent debounce timer and its
 * own PATCH, exactly as before. On: deal- and lead-custom-field keys pending
 * within the same debounce window are merged into one request against the
 * dedicated bulk endpoint instead of one PATCH per field. Other key types
 * (contact/hibarr/native/unanswered) aren't covered by that endpoint and
 * always use the original per-key flow regardless of this flag.
 */
const CUSTOM_FIELDS_BULK_FLAG = "crm.custom-fields-cross-model-optimizations";

interface PendingWrite {
    timer: ReturnType<typeof setTimeout>;
    payload: { type: string; data: Record<string, unknown> };
}

interface FailedKey {
    key: string;
    retry: () => void;
}

interface CustomFieldEntry {
    scope: "deal" | "lead";
    fieldKey: string; // "field_12"
    value: unknown;
}

export default function useAnalysisFieldSave(dealId: number) {
    const { props } = usePage<any>();
    const bulkWriteEnabled =
        props.featureFlags?.[CUSTOM_FIELDS_BULK_FLAG] === true;

    const pending = useRef<Map<string, PendingWrite>>(new Map());
    const customFieldPending = useRef<Map<string, CustomFieldEntry>>(new Map());
    const customFieldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlight = useRef<Set<Promise<unknown>>>(new Set());
    const [failedKeys, setFailedKeys] = useState<FailedKey[]>([]);

    // Saving state is published to subscribers rather than held in state here:
    // a setState in this hook would re-render the whole modal on every keystroke.
    const listeners = useRef<Set<(saving: boolean) => void>>(new Set());

    const notify = useCallback(() => {
        const saving =
            pending.current.size > 0 ||
            customFieldPending.current.size > 0 ||
            inFlight.current.size > 0;
        listeners.current.forEach((l) => l(saving));
    }, []);

    const subscribeSaving = useCallback((cb: (saving: boolean) => void) => {
        listeners.current.add(cb);
        cb(
            pending.current.size > 0 ||
                customFieldPending.current.size > 0 ||
                inFlight.current.size > 0,
        );
        return () => {
            listeners.current.delete(cb);
        };
    }, []);

    // Track a request so flushAll() can await everything still on the wire.
    const track = useCallback(
        (p: Promise<unknown>) => {
            inFlight.current.add(p);
            notify();
            p.catch(() => {}).then(() => {
                inFlight.current.delete(p);
                notify();
            });
            return p;
        },
        [notify],
    );

    const isCustomFieldKey = useCallback(
        (key: string) =>
            key.startsWith("deal_field_") || key.startsWith("lead_field_"),
        [],
    );

    const toCustomFieldEntry = useCallback(
        (key: string, value: unknown): CustomFieldEntry => {
            if (key.startsWith("deal_field_")) {
                return {
                    scope: "deal",
                    fieldKey: `field_${key.replace("deal_field_", "")}`,
                    value,
                };
            }
            return {
                scope: "lead",
                fieldKey: `field_${key.replace("lead_field_", "")}`,
                value,
            };
        },
        [],
    );

    // Sends every entry in the given map as one bulk request — used both for
    // the coalesced debounce flush (many keys) and for retrying a single
    // failed key (a "bulk of one", same endpoint, no special-casing needed).
    const sendCustomFieldBatch = useCallback(
        (entries: Map<string, CustomFieldEntry>) => {
            const deal: Record<string, unknown> = {};
            const lead: Record<string, unknown> = {};
            entries.forEach(({ scope, fieldKey, value }) => {
                (scope === "deal" ? deal : lead)[fieldKey] = value;
            });

            const body: Record<string, unknown> = {};
            if (Object.keys(deal).length) body.deal = deal;
            if (Object.keys(lead).length) body.lead = lead;

            const keys = [...entries.keys()];

            return track(
                axios
                    .patch(
                        route("deals.gathering.custom_fields_bulk", {
                            id: dealId,
                        }),
                        body,
                        {
                            headers: {
                                Accept: "application/json",
                                "X-Analysis-Lean": "1",
                            },
                        },
                    )
                    .catch(() => {
                        setFailedKeys((prev) => {
                            const filtered = prev.filter(
                                (f) => !keys.includes(f.key),
                            );
                            const retried = keys.map((key) => ({
                                key,
                                retry: () => {
                                    const entry = entries.get(key);
                                    if (!entry) return;
                                    setFailedKeys((p) =>
                                        p.filter((f) => f.key !== key),
                                    );
                                    sendCustomFieldBatch(
                                        new Map([[key, entry]]),
                                    );
                                },
                            }));
                            return [...filtered, ...retried];
                        });
                    }),
            );
        },
        [dealId, track],
    );

    const flushCustomFields = useCallback(() => {
        if (customFieldTimer.current) {
            clearTimeout(customFieldTimer.current);
            customFieldTimer.current = null;
        }
        if (customFieldPending.current.size === 0) return;
        const entries = new Map(customFieldPending.current);
        customFieldPending.current.clear();
        sendCustomFieldBatch(entries);
        notify();
    }, [sendCustomFieldBatch, notify]);

    // Dispatches every debounced write immediately and resolves once all
    // outstanding requests settle — so callers can reload after saves land.
    const flushAll = useCallback((): Promise<void> => {
        pending.current.forEach(({ timer, payload }) => {
            clearTimeout(timer);
            track(
                axios
                    .patch(
                        route("deals.gathering.inline_update", { id: dealId }),
                        payload,
                        {
                            headers: {
                                Accept: "application/json",
                                "X-Analysis-Lean": "1",
                            },
                        },
                    )
                    .catch(() => {}),
            );
        });
        pending.current.clear();
        flushCustomFields();
        notify();
        return Promise.all([...inFlight.current]).then(() => undefined);
    }, [dealId, track, notify, flushCustomFields]);

    // Flush on unmount and page unload
    useEffect(() => {
        const handler = () => flushAll();
        window.addEventListener("beforeunload", handler);
        return () => {
            window.removeEventListener("beforeunload", handler);
            flushAll();
        };
    }, [flushAll]);

    const resolveUpdateType = useCallback((key: string): string => {
        if (key.startsWith("deal_field_")) return "custom_field";
        if (key.startsWith("lead_field_")) return "lead_custom_field";
        if (key.startsWith("hibarr:")) return "hibarr_field";
        if (key.startsWith("contact:")) return "contact";
        if (key.startsWith("unanswered:")) return "analysis_unanswered";
        return "details";
    }, []);

    const buildData = useCallback(
        (key: string, value: unknown): Record<string, unknown> => {
            if (key.startsWith("deal_field_")) {
                const fieldId = key.replace("deal_field_", "");
                return { [`field_${fieldId}`]: value };
            }
            if (key.startsWith("lead_field_")) {
                const fieldId = key.replace("lead_field_", "");
                return { [`field_${fieldId}`]: value };
            }
            if (key.startsWith("native:"))
                return { [key.replace("native:", "")]: value };
            if (key.startsWith("hibarr:"))
                return { [key.replace("hibarr:", "")]: value };
            if (key.startsWith("contact:"))
                return { [key.replace("contact:", "")]: value };
            if (key.startsWith("unanswered:"))
                return { [key.replace("unanswered:", "")]: value };
            return { [key]: value };
        },
        [],
    );

    // Original per-key path — every key, its own timer, its own PATCH. Used
    // for every key when the flag is off, and always for types the bulk
    // endpoint doesn't cover (contact/hibarr/native/unanswered/details).
    const sendLegacy = useCallback(
        (
            key: string,
            payload: { type: string; data: Record<string, unknown> },
        ) => {
            return track(
                axios
                    .patch(
                        route("deals.gathering.inline_update", { id: dealId }),
                        payload,
                        {
                            headers: {
                                Accept: "application/json",
                                "X-Analysis-Lean": "1",
                            },
                        },
                    )
                    .catch(() => {
                        setFailedKeys((prev) => {
                            const filtered = prev.filter((f) => f.key !== key);
                            return [
                                ...filtered,
                                {
                                    key,
                                    retry: () => {
                                        setFailedKeys((p) =>
                                            p.filter((f) => f.key !== key),
                                        );
                                        sendLegacy(key, payload);
                                    },
                                },
                            ];
                        });
                    }),
            );
        },
        [dealId, track],
    );

    const saveLegacy = useCallback(
        (key: string, value: unknown) => {
            const existing = pending.current.get(key);
            if (existing) clearTimeout(existing.timer);

            const type = resolveUpdateType(key);
            const data = buildData(key, value);
            const payload = { type, data };

            const timer = setTimeout(() => {
                pending.current.delete(key);
                sendLegacy(key, payload);
            }, 400);

            pending.current.set(key, { timer, payload });
            notify();
        },
        [resolveUpdateType, buildData, sendLegacy, notify],
    );

    const save = useCallback(
        (key: string, value: unknown) => {
            if (bulkWriteEnabled && isCustomFieldKey(key)) {
                customFieldPending.current.set(
                    key,
                    toCustomFieldEntry(key, value),
                );
                if (customFieldTimer.current)
                    clearTimeout(customFieldTimer.current);
                customFieldTimer.current = setTimeout(flushCustomFields, 400);
                notify();
                return;
            }
            saveLegacy(key, value);
        },
        [
            bulkWriteEnabled,
            isCustomFieldKey,
            toCustomFieldEntry,
            flushCustomFields,
            notify,
            saveLegacy,
        ],
    );

    const retry = useCallback(
        (key: string) => {
            const failed = failedKeys.find((f) => f.key === key);
            failed?.retry();
        },
        [failedKeys],
    );

    const dismissError = useCallback((key: string) => {
        setFailedKeys((prev) => prev.filter((f) => f.key !== key));
    }, []);

    return { save, failedKeys, retry, dismissError, flushAll, subscribeSaving };
}
