import { useEffect, useState } from "react";
import axios from "axios";

export type WriteMode = "fill_empty" | "overwrite";

export interface FieldMappingRow {
    segment_key: string;
    lead_field: string | null;
    /** Resolved server-side so callers never decode `custom_field_<id>`. */
    lead_field_label?: string;
    write_mode: WriteMode;
    /** script option key -> lead field value */
    option_map: Record<string, string>;
}

export interface ScriptMapping {
    template_id: string;
    auto_write: boolean;
    /** OL webinar used by the inviteWebinar outcome when the script carries none. */
    webinar_id: string | null;
    mappings: FieldMappingRow[];
}

export interface LeadFieldOption {
    value: string;
    label: string;
    group: string;
    /** Empty for free-text fields — those take the answer verbatim. */
    values: Array<{ value: string; label: string }>;
}

const normalize = (raw: unknown, templateId: string): ScriptMapping => {
    const data = (raw ?? {}) as Partial<ScriptMapping>;
    return {
        template_id: templateId,
        auto_write: data.auto_write !== false,
        webinar_id: data.webinar_id || null,
        mappings: (data.mappings ?? []).map((row) => ({
            segment_key: row.segment_key,
            lead_field: row.lead_field ?? null,
            lead_field_label: row.lead_field_label ?? row.lead_field ?? undefined,
            write_mode: row.write_mode === "overwrite" ? "overwrite" : "fill_empty",
            option_map: (row.option_map ?? {}) as Record<string, string>,
        })),
    };
};

export async function fetchScriptMapping(
    templateId: string,
): Promise<ScriptMapping> {
    const response = await axios.get(
        route("qualification-field-mapping.show", { templateId }),
        { headers: { Accept: "application/json" } },
    );
    return normalize(response.data, templateId);
}

export async function saveScriptMapping(
    templateId: string,
    payload: { template_name?: string | null } & Omit<ScriptMapping, "template_id">,
): Promise<void> {
    await axios.put(
        route("qualification-field-mapping.update", { templateId }),
        payload,
        { headers: { Accept: "application/json" } },
    );
}

/** Read-only mapping lookup for the qualification tab's "Written to" badges. */
export function useScriptMapping(templateId: string | null | undefined) {
    const [mapping, setMapping] = useState<ScriptMapping | null>(null);

    useEffect(() => {
        if (!templateId) {
            setMapping(null);
            return;
        }

        let cancelled = false;
        void fetchScriptMapping(templateId)
            .then((result) => {
                if (!cancelled) setMapping(result);
            })
            .catch(() => {
                // Mapping is decoration here — the answers still render without it.
                if (!cancelled) setMapping(null);
            });

        return () => {
            cancelled = true;
        };
    }, [templateId]);

    return mapping;
}
