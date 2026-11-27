export type PipelineOfferingType = "property" | "package" | "both";

export interface DealPipelineRow {
    id: number;
    name: string;
    label_color: string | null;
    default: boolean;
    hidden_from_nav: boolean;
    hidden_from_system: boolean;
    offering_type: PipelineOfferingType;
    stages_count: number;
}

export interface PipelineStageRow {
    id: number;
    name: string;
    label_color: string;
    priority: number;
    default: boolean;
}

export interface CategoryOption {
    id: number;
    name: string;
}

export interface FieldOptionGroup {
    model: string;
    label: string;
    items: Array<{ value: string; label: string }>;
}

export interface PipelineEditorPayload {
    pipeline: {
        id: number;
        name: string;
        label_color: string;
        default: boolean;
        hidden_from_nav: boolean;
        hidden_from_system: boolean;
        hide_all_categories: boolean;
        offering_type: PipelineOfferingType;
    };
    stages: PipelineStageRow[];
    categories: CategoryOption[];
    category_scopes: {
        __pipeline__: number[];
        stages: Record<string, number[]>;
    };
    field_scopes: {
        __pipeline__: string[];
        stages: Record<string, string[]>;
    };
    field_options: FieldOptionGroup[];
}
