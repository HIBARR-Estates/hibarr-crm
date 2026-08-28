export interface AnalysisScriptItem {
    id: number;
    type:
        | "custom_field_category"
        | "native_field"
        | "hibarr_field"
        | "lead_field"
        | "question"
        | "instruction"
        /** Opens a hand-built section; label_override is its title. */
        | "section"
        /** A single custom field by id, rather than a whole category. */
        | "deal_custom_field"
        | "lead_custom_field";
    item_key: string;
    label_override?: string | null;
    guide_text?: string | null;
    position: number;
}

export type AnalysisSectionItemKind =
    | "custom_field"
    | "question"
    | "instruction"
    | "native_field"
    | "hibarr_field"
    | "lead_field"
    | "deal_custom_field"
    | "lead_custom_field";

export interface AnalysisSectionItem {
    kind: AnalysisSectionItemKind;
    scriptItem: AnalysisScriptItem;
    number?: number;
}

export interface AnalysisSection {
    id: string;
    title: string;
    guideText?: string | null;
    /**
     * "category" auto-expands to every field in `categoryId`; "custom" renders only
     * the explicit `items` an admin placed in it.
     */
    kind: "category" | "custom";
    /** Parsed from item_key for custom_field_category items; null for custom sections */
    categoryId: number | null;
    items: AnalysisSectionItem[];
}
