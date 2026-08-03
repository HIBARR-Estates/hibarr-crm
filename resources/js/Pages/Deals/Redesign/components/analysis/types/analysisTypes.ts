export interface AnalysisScriptItem {
    id: number;
    type:
        | "custom_field_category"
        | "native_field"
        | "hibarr_field"
        | "lead_field"
        | "question"
        | "instruction";
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
    | "lead_field";

export interface AnalysisSectionItem {
    kind: AnalysisSectionItemKind;
    scriptItem: AnalysisScriptItem;
    number?: number;
}

export interface AnalysisSection {
    id: string;
    title: string;
    guideText?: string | null;
    /** Parsed from item_key for custom_field_category items; null for the fallback General section */
    categoryId: number | null;
    items: AnalysisSectionItem[];
}
