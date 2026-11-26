import { useFormData } from "@/Hooks/useFormData";
import { parseUtmField, UTM_FORM_DATA_TYPES, UtmColumn } from "../config/builderFields";

type Option = { value: string; label: string };

interface UtmRow {
    value: string;
    label?: string;
    count?: number;
}

/**
 * Recorded values for each UTM column, from the same form-data endpoints the
 * lead filter uses. A column's list is only requested once a condition actually
 * targets it, so the builder doesn't fetch six lists nobody asked for.
 */
export default function useUtmValueOptions(fields: Array<string | null | undefined>): Record<UtmColumn, Option[]> {
    const used = new Set(fields.map((f) => parseUtmField(f)?.column).filter(Boolean) as UtmColumn[]);
    const query = (column: UtmColumn) =>
        useFormData<UtmRow>(UTM_FORM_DATA_TYPES[column], { paginate: false, enabled: used.has(column) });
    const toOptions = (rows: UtmRow[]): Option[] =>
        rows.map((r) => ({ value: r.value, label: r.count ? `${r.label ?? r.value} (${r.count})` : (r.label ?? r.value) }));

    // Fixed call order on every render — hooks rule holds.
    return {
        utm_source: toOptions(query("utm_source").data),
        utm_medium: toOptions(query("utm_medium").data),
        utm_campaign: toOptions(query("utm_campaign").data),
        utm_content: toOptions(query("utm_content").data),
        utm_term: toOptions(query("utm_term").data),
        utm_audience: toOptions(query("utm_audience").data),
    };
}
