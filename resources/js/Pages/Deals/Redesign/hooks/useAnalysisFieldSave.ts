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
    const [failedKeys, setFailedKeys] = useState<FailedKey[]>([]);

    const flushAll = useCallback(() => {
        pending.current.forEach(({ timer, payload }) => {
            clearTimeout(timer);
            axios.patch(
                route("deals.gathering.inline_update", { id: dealId }),
                payload,
                { headers: { Accept: "application/json", "X-Analysis-Lean": "1" } },
            ).catch(() => {});
        });
        pending.current.clear();
    }, [dealId]);

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

        const timer = setTimeout(async () => {
            pending.current.delete(key);
            try {
                await axios.patch(
                    route("deals.gathering.inline_update", { id: dealId }),
                    payload,
                    { headers: { Accept: "application/json", "X-Analysis-Lean": "1" } },
                );
            } catch {
                setFailedKeys((prev) => {
                    // deduplicate by key
                    const filtered = prev.filter((f) => f.key !== key);
                    return [...filtered, { key, payload }];
                });
            }
        }, 400);

        pending.current.set(key, { timer, payload });
    }, [dealId, resolveUpdateType, buildData]);

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

    return { save, failedKeys, retry, dismissError, flushAll };
}
