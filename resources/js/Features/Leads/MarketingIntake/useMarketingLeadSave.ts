import { useCallback, useState } from "react";
import axios from "axios";
import type { SavedMarketingLead } from "./types";

export type SaveResult =
    | { ok: true; lead: SavedMarketingLead }
    | { ok: false; errors: Record<string, string>; message: string | null };

/** POST marketing-leads. Returns field errors keyed like the payload (client_email, notes.0.details…). */
export default function useMarketingLeadSave() {
    const [saving, setSaving] = useState(false);

    const save = useCallback(async (payload: Record<string, unknown>): Promise<SaveResult> => {
        setSaving(true);
        try {
            const res = await axios.post(route("marketing-leads.store"), payload, {
                headers: { Accept: "application/json" },
            });
            if (res.data?.status === "success" && res.data?.lead) {
                return { ok: true, lead: res.data.lead as SavedMarketingLead };
            }
            return { ok: false, errors: {}, message: res.data?.message ?? null };
        } catch (error) {
            const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
            const raw = (data?.errors ?? {}) as Record<string, string[] | string>;
            const errors: Record<string, string> = {};
            for (const [key, value] of Object.entries(raw)) {
                const first = Array.isArray(value) ? value[0] : value;
                if (typeof first === "string") errors[key] = first;
            }
            return {
                ok: false,
                errors,
                message: typeof data?.message === "string" ? data.message : null,
            };
        } finally {
            setSaving(false);
        }
    }, []);

    return { save, saving };
}
