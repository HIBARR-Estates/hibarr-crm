import { ShowRuleSet } from "@/Types";

/** The 15 built-in modules a custom field can belong to (custom_field_groups row). */
export interface ModuleGroup {
    id: number;
    name: string;
    model: string;
}

export const FIELD_TYPES = [
    "text",
    "textarea",
    "number",
    "select",
    "multiselect",
    "radio",
    "checkbox",
    "date",
    "datetime",
    "email",
    "url",
    "phone",
    "file",
    "repeatable",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<string, string> = {
    text: "Text",
    textarea: "Text area",
    number: "Number",
    select: "Dropdown",
    multiselect: "Multi-select",
    radio: "Radio",
    checkbox: "Checkbox",
    date: "Date",
    datetime: "Date & time",
    email: "Email",
    url: "URL",
    mobile: "Phone",
    phone: "Phone",
    file: "File",
    repeatable: "Repeatable",
    password: "Password",
    country: "Country",
    multiSelectCountry: "Multi-select country",
    currency: "Currency",
    range: "Range",
    currency_range: "Currency range",
};

/** Types that store a list of option strings in `values`. */
export const OPTION_VALUE_TYPES = ["select", "multiselect", "radio", "checkbox"] as const;

/** The settings-page shape of a custom field — see CustomField::toAdminArray(). */
export interface SettingsField {
    id: number;
    custom_field_group_id: number;
    module: string;
    label: string;
    name: string;
    type: string;
    values: string[];
    required: "yes" | "no";
    export: boolean;
    visible: boolean;
    custom_field_category_id: number | null;
    category_name: string | null;
    display_order: number;
    linked_field_id: number | null;
    display_config: Record<string, unknown> | null;
    /** FILE fields on the Lead module only — whether this field's slot may appear on the lead page / a matching deal page. Default true. */
    show_in_lead: boolean;
    show_in_deal: boolean;
    show_rule_set: ShowRuleSet | null;
}

/** The settings-page shape of a category — see CustomFieldSettingsController::index(). */
export interface SettingsCategory {
    id: number;
    name: string;
    custom_field_group_id: number;
    module: string;
    order: number;
}

export interface FieldDraft {
    module: number | "";
    label: string;
    type: string;
    category: number | "";
    required: "yes" | "no";
    visible: boolean;
    export: boolean;
    display_order: number;
    values: string[];
    show_in_lead: boolean;
    show_in_deal: boolean;
}

export interface CategoryDraft {
    name: string;
    custom_field_group_id: number | "";
    /** "" (not 0) for a new category — lets CustomFieldCategoryController::store() compute the append position. */
    order: number | "";
}

export function fieldHasRule(field: SettingsField): boolean {
    const rs = field.show_rule_set;
    if (!rs || !rs.enabled) return false;
    const groups = rs.groups?.length ? rs.groups : rs.group ? [rs.group] : [];
    return groups.some((g) => (g.criteria?.length ?? 0) > 0);
}
