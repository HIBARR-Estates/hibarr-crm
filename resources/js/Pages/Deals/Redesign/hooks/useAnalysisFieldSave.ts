import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

interface PendingWrite {
    timer: ReturnType<typeof setTimeout>;
    payload: { type: string; data: Record<string, unknown> };
}

interface FailedKey {
    key: string;
    payload: { type: string; data: Record<string, unknown> };
}

export default function useAnalysisFieldSave(dealId: number) {
    const pending = useRef<Map<string, PendingWrite>>(new Map());
    const inFlight = useRef<Set<Promise<unknown>>>(new Set());
    const [failedKeys, setFailedKeys] = useState<FailedKey[]>([]);

    // Saving state is published to subscribers rather than held in state here:
    // a setState in this hook would re-render the whole modal on every keystroke.
    const listeners = useRef<Set<(saving: boolean) => void>>(new Set());

    const notify = useCallback(() => {
        const saving = pending.current.size > 0 || inFlight.current.size > 0;
        listeners.current.forEach((l) => l(saving));
    }, []);

    const subscribeSaving = useCallback((cb: (saving: boolean) => void) => {
        listeners.current.add(cb);
        cb(pending.current.size > 0 || inFlight.current.size > 0);
        return () => {
            listeners.current.delete(cb);
        };
    }, []);

    // Track a request so flushAll() can await everything still on the wire.
    const track = useCallback((p: Promise<unknown>) => {
        inFlight.current.add(p);
        notify();
        p.catch(() => {}).then(() => {
            inFlight.current.delete(p);
            notify();
        });
        return p;
    }, [notify]);

    // Dispatches every debounced write immediately and resolves once all
    // outstanding requests settle — so callers can reload after saves land.
    const flushAll = useCallback((): Promise<void> => {
        pending.current.forEach(({ timer, payload }) => {
            clearTimeout(timer);
            track(
                axios.patch(
                    route("deals.gathering.inline_update", { id: dealId }),
                    payload,
                    { headers: { Accept: "application/json", "X-Analysis-Lean": "1" } },
                ).catch(() => {}),
            );
        });
        pending.current.clear();
        notify();
        return Promise.all([...inFlight.current]).then(() => undefined);
    }, [dealId, track, notify]);

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
        return "details";
    }, []);

    const buildData = useCallback((key: string, value: unknown): Record<string, unknown> => {
        if (key.startsWith("deal_field_")) {
            const fieldId = key.replace("deal_field_", "");
            return { [`field_${fieldId}`]: value };
        }
        if (key.startsWith("lead_field_")) {
            const fieldId = key.replace("lead_field_", "");
            return { [`field_${fieldId}`]: value };
        }
        if (key.startsWith("native:")) return { [key.replace("native:", "")]: value };
        if (key.startsWith("hibarr:")) return { [key.replace("hibarr:", "")]: value };
        if (key.startsWith("contact:")) return { [key.replace("contact:", "")]: value };
        return { [key]: value };
    }, []);

    const save = useCallback((key: string, value: unknown) => {
        const existing = pending.current.get(key);
        if (existing) clearTimeout(existing.timer);

        const type = resolveUpdateType(key);
        const data = buildData(key, value);
        const payload = { type, data };

        const timer = setTimeout(() => {
            pending.current.delete(key);
            track(
                axios.patch(
                    route("deals.gathering.inline_update", { id: dealId }),
                    payload,
                    { headers: { Accept: "application/json", "X-Analysis-Lean": "1" } },
                ).catch(() => {
                    setFailedKeys((prev) => {
                        const filtered = prev.filter((f) => f.key !== key);
                        return [...filtered, { key, payload }];
                    });
                }),
            );
        }, 400);

        pending.current.set(key, { timer, payload });
        notify();
    }, [dealId, resolveUpdateType, buildData, track, notify]);

    const retry = useCallback((key: string) => {
        const failed = failedKeys.find((f) => f.key === key);
        if (!failed) return;
        setFailedKeys((prev) => prev.filter((f) => f.key !== key));
        axios.patch(
            route("deals.gathering.inline_update", { id: dealId }),
            failed.payload,
            { headers: { Accept: "application/json", "X-Analysis-Lean": "1" } },
        ).catch(() => {
            setFailedKeys((prev) => [...prev, failed]);
        });
    }, [dealId, failedKeys]);

    const dismissError = useCallback((key: string) => {
        setFailedKeys((prev) => prev.filter((f) => f.key !== key));
    }, []);

    return { save, failedKeys, retry, dismissError, flushAll, subscribeSaving };
}
