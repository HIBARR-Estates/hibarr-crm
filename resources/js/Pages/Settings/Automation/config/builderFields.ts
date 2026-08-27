import { AutomationCatalog, ConditionOperator, CustomFieldOption, SubjectType } from "../types";

/** Mirrors condition-row.blade.php's operator <select> exactly. "changed" is
 * accepted for parity with the Blade UI but is a pre-existing no-op in
 * ConditionEvaluatorService (always evaluates false) — not fixed here. */
export const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
    { value: "=", label: "Equals" },
    { value: ">", label: "Greater Than" },
    { value: "<", label: "Less Than" },
    { value: "contains", label: "Contains" },
    { value: "exists", label: "Exists (Not Empty)" },
    { value: "changed", label: "Changed" },
];

/** Deal-native fields — not part of AutomationFieldCatalog, hardcoded the
 * same way in _field-options.blade.php's "Native Fields" optgroup. */
export const DEAL_NATIVE_FIELDS: Record<string, string> = {
    value: "Deal Value",
    pipeline_stage_id: "Stage",
};

/** "Deal Fields" optgroup in action-row.blade.php's Set Field Value picker —
 * a different, hand-picked subset from AutomationFieldCatalog::HIBARR_FIELDS
 * (adds outcome_status, drops "message"), because only these are meaningful
 * as a direct $deal->{field} assignment. */
export const DEAL_SETTABLE_FIELDS: Record<string, string> = {
    outcome_status: "Outcome Status",
    interested_in: "Interested In",
    motivation: "Motivation",
    purchase_timeline: "Purchase Timeline",
    budget_range: "Budget Range",
    strategy_meeting_booked: "Strategy Meeting Booked",
    downpayment_paid: "Downpayment Paid",
    deposit_confirmation: "Deposit Confirmation",
    reservation_agreement: "Reservation Agreement",
    sales_contract: "Sales Contract",
};

const DEAL_BOOLEAN_FIELDS = new Set([
    "strategy_meeting_booked",
    "downpayment_paid",
    "deposit_confirmation",
    "reservation_agreement",
    "sales_contract",
]);

/** Fixed option list for a set_field_value action's Value input, when the
 * chosen field has a known finite set of values — matches action-row.blade.php. */
export function fieldValueOptions(fieldName: string | null): { value: string; label: string }[] | null {
    if (fieldName === "outcome_status") {
        return [
            { value: "won", label: "Won" },
            { value: "lost", label: "Lost" },
        ];
    }
    if (fieldName === "temperature") {
        return [
            { value: "cold", label: "Cold" },
            { value: "warm", label: "Warm" },
            { value: "hot", label: "Hot" },
        ];
    }
    if (fieldName && DEAL_BOOLEAN_FIELDS.has(fieldName)) {
        return [
            { value: "1", label: "True / Yes" },
            { value: "0", label: "False / No" },
        ];
    }
    return null;
}

/** Fixed brackets — App\Enums\AgeRange's exact backing values. */
const AGE_RANGE_OPTIONS = [
    { value: "under 20", label: "Under 20" },
    { value: "20-25", label: "20-25" },
    { value: "26-30", label: "26-30" },
    { value: "31-40", label: "31-40" },
    { value: "41-50", label: "41-50" },
    { value: "51-65", label: "51-65" },
    { value: "above 66", label: "Above 66" },
];

function catalogLookupOptions(rows: { id: number; name: string | null }[] | undefined): { value: string; label: string }[] {
    return (rows ?? []).map((r) => ({ value: String(r.id), label: r.name || `#${r.id}` }));
}

/** select/radio/checkbox/multiselect custom fields store the option's own
 * label text as the stored value (not an index) — confirmed against live
 * custom_fields_data rows. `values` is CustomField::$values, a JSON-encoded
 * array of those label strings; it comes through the catalog un-decoded
 * (no cast on the backend), so it may still be a raw JSON string here. */
const OPTION_CUSTOM_FIELD_TYPES = new Set(["select", "radio", "checkbox", "multiselect"]);

function customFieldValueOptions(field: CustomFieldOption | undefined): { value: string; label: string }[] | null {
    if (!field || !OPTION_CUSTOM_FIELD_TYPES.has(field.type)) return null;

    let values: unknown = field.values;
    if (typeof values === "string") {
        try {
            values = JSON.parse(values);
        } catch {
            values = null;
        }
    }
    if (!Array.isArray(values) || values.length === 0) return null;

    return values.map((v) => ({ value: String(v), label: String(v) }));
}

/** Fixed option list for a condition's Value input, when the selected field
 * has a known finite set of values — a select-typed field (see
 * fieldValueType()) always resolves here or falls back to free text.
 * Doesn't handle "pipeline_stage_id" — that needs the automation's own
 * pipeline scope, supplied separately at the call site. */
export function conditionValueOptions(fieldKey: string | null | undefined, catalog: AutomationCatalog | null): { value: string; label: string }[] | null {
    if (!fieldKey || !catalog) return null;

    if (fieldKey.startsWith("custom_field_")) {
        const id = Number(fieldKey.slice("custom_field_".length));
        return customFieldValueOptions(catalog.dealCustomFields.find((f) => f.id === id));
    }

    if (fieldKey.startsWith("lead_custom_field_")) {
        const id = Number(fieldKey.slice("lead_custom_field_".length));
        return customFieldValueOptions(catalog.leadCustomFields.find((f) => f.id === id));
    }

    const bareKey = fieldKey.startsWith("lead_field_") ? fieldKey.slice("lead_field_".length) : fieldKey;

    const shared = fieldValueOptions(bareKey);
    if (shared) return shared;

    switch (bareKey) {
        case "gender":
            return [
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
            ];
        case "type":
            return [
                { value: "agent", label: "Agent" },
                { value: "customer", label: "Customer" },
            ];
        case "age_range":
            return AGE_RANGE_OPTIONS;
        case "category_id":
            return catalogLookupOptions(catalog.leadCategories);
        case "source_id":
            return catalogLookupOptions(catalog.leadSources);
        case "lead_lifecycle_status_id":
            return catalogLookupOptions(catalog.leadLifecycleStatuses);
        case "lead_owner":
            return catalogLookupOptions(catalog.users.map((u) => ({ id: u.id, name: u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || null })));
        case "referred_by_agent_id":
            return catalogLookupOptions(catalog.leadAgents);
        default:
            return null;
    }
}

export interface FieldOptionGroup {
    label: string;
    options: { value: string; label: string }[];
}

/** Grouped field picker for the condition builder — mirrors
 * _field-options.blade.php + _lead-field-options.blade.php exactly: a
 * lead-subject automation only ever sees the Lead Fields / Lead Custom
 * Fields groups (its "subject-group-deal" groups are hidden), a deal-subject
 * automation sees everything (a deal's linked lead fields are reachable too). */
export function conditionFieldGroups(subjectType: SubjectType, catalog: AutomationCatalog): FieldOptionGroup[] {
    const groups: FieldOptionGroup[] = [];

    if (subjectType === "deal") {
        groups.push({ label: "Native Fields", options: toOptions(DEAL_NATIVE_FIELDS) });
        groups.push({ label: "Hibarr Fields", options: toOptions(catalog.hibarrFields) });
        groups.push({ label: "Related Data", options: toOptions(catalog.relatedFields) });
        groups.push({
            label: "Custom Fields",
            options: catalog.dealCustomFields.map((f) => ({ value: `custom_field_${f.id}`, label: f.label })),
        });
    }

    groups.push({
        label: "Lead Fields",
        options: toOptions(catalog.leadFields, "lead_field_"),
    });
    groups.push({
        label: "Lead Custom Fields",
        options: catalog.leadCustomFields.map((f) => ({
            value: `lead_custom_field_${f.id}`,
            label: f.label,
        })),
    });

    return groups.filter((g) => g.options.length > 0);
}

function toOptions(dict: Record<string, string>, prefix = ""): { value: string; label: string }[] {
    return Object.entries(dict).map(([key, label]) => ({ value: `${prefix}${key}`, label }));
}

/** "Deal Name"/"Deal Value" — the two native merge tags _tag-picker.blade.php
 * hardcodes for message text (distinct from the condition builder's Native
 * Fields group, which uses `pipeline_stage_id` instead of `name` since a
 * stage ID is only meaningful for filtering, not for personalized text). */
const MERGE_NATIVE_FIELDS: Record<string, string> = {
    name: "Deal Name",
    value: "Deal Value",
};

/** Grouped merge-tag picker for free-text fields (task/note title & content,
 * meta conversion event name). Subject-aware like conditionFieldGroups(): a
 * lead action only has lead data to pull a tag from, so it only gets the Lead
 * groups; a deal action can also reach the deal's linked lead, so it gets
 * everything. Inserted tags use `{{tag}}` syntax, resolved by
 * DealAutomationService::renderPlainTemplateText(). */
export function mergeTagGroups(subjectType: SubjectType, catalog: AutomationCatalog): FieldOptionGroup[] {
    const groups: FieldOptionGroup[] = [];

    if (subjectType === "deal") {
        groups.push({ label: "Deal Fields", options: toOptions(MERGE_NATIVE_FIELDS) });
        groups.push({ label: "Hibarr Fields", options: toOptions(catalog.hibarrFields) });
        groups.push({ label: "Related Data", options: toOptions(catalog.relatedFields) });
        groups.push({
            label: "Deal Custom Fields",
            options: catalog.dealCustomFields.map((f) => ({ value: `custom_field_${f.id}`, label: f.label })),
        });
    }

    groups.push({ label: "Lead Fields", options: toOptions(catalog.leadFields, "lead_field_") });
    groups.push({
        label: "Lead Custom Fields",
        options: catalog.leadCustomFields.map((f) => ({ value: `lead_custom_field_${f.id}`, label: f.label })),
    });

    return groups.filter((g) => g.options.length > 0);
}

/**
 * Coarse value-type classification for condition fields, used to hide
 * operators that don't make sense for a field's type (e.g. "Greater Than" on
 * a text field). Backend evaluation (ConditionEvaluatorService) already
 * numeric-coerces both sides for `=`/`>`/`<` when the value looks numeric —
 * this is purely about not offering a nonsensical operator in the UI.
 */
export type FieldValueType = "number" | "date" | "select" | "string" | "file" | "unknown";

const NATIVE_FIELD_TYPES: Record<string, FieldValueType> = {
    // DEAL_NATIVE_FIELDS
    value: "number",
    pipeline_stage_id: "select",
    // HIBARR_FIELDS
    interested_in: "string",
    motivation: "string",
    purchase_timeline: "string",
    budget_range: "string",
    message: "string",
    strategy_meeting_booked: "select",
    downpayment_paid: "select",
    inspection_trip_date: "date",
    deposit_confirmation: "select",
    reservation_agreement: "select",
    sales_contract: "select",
    // RELATED_FIELDS
    followup_count: "number",
    last_followup_days_ago: "number",
    last_followup_status: "string",
    next_followup_date: "date",
};

const LEAD_FIELD_TYPES: Record<string, FieldValueType> = {
    client_name: "string",
    client_email: "string",
    mobile: "string",
    cell: "string",
    office: "string",
    client_whatsapp: "string",
    client_instagram: "string",
    client_telegram: "string",
    country: "string",
    city: "string",
    state: "string",
    postal_code: "string",
    address: "string",
    website: "string",
    company_name: "string",
    note: "string",
    salutation: "string",
    age: "number",
    age_range: "select",
    date_of_birth: "date",
    gender: "select",
    nationality: "string",
    occupation: "string",
    primary_language: "string",
    preferred_contact_time: "string",
    type: "select",
    temperature: "select",
    category_id: "select",
    source_id: "select",
    lead_lifecycle_status_id: "select",
    lead_owner: "select",
    referred_by_agent_id: "select",
    assigned_at: "date",
    first_contacted_at: "date",
    created_at: "date",
};

/** Keyed by CustomField::$type (see CustomFieldController's $types list). */
const CUSTOM_FIELD_TYPE_CATEGORY: Record<string, FieldValueType> = {
    text: "string",
    textarea: "string",
    password: "string",
    phone: "string",
    country: "string",
    // A file either has been uploaded or hasn't — there's no meaningful
    // "value" to compare against, only presence/absence.
    file: "file",
    number: "number",
    currency: "number",
    range: "number",
    currency_range: "number",
    date: "date",
    select: "select",
    radio: "select",
    checkbox: "select",
    multiselect: "select",
    multiSelectCountry: "select",
    repeatable: "select",
};

/** Resolve a condition field key (as produced by conditionFieldGroups()) to
 * its coarse value type. Unrecognized/unselected fields resolve to "unknown"
 * (every operator stays available) rather than silently hiding operators for
 * a field we can't actually classify. */
export function fieldValueType(fieldKey: string | null | undefined, catalog: AutomationCatalog | null): FieldValueType {
    if (!fieldKey || !catalog) return "unknown";

    if (fieldKey.startsWith("custom_field_")) {
        const id = Number(fieldKey.slice("custom_field_".length));
        const field = catalog.dealCustomFields.find((f) => f.id === id);
        return (field && CUSTOM_FIELD_TYPE_CATEGORY[field.type]) || "unknown";
    }

    if (fieldKey.startsWith("lead_custom_field_")) {
        const id = Number(fieldKey.slice("lead_custom_field_".length));
        const field = catalog.leadCustomFields.find((f) => f.id === id);
        return (field && CUSTOM_FIELD_TYPE_CATEGORY[field.type]) || "unknown";
    }

    if (fieldKey.startsWith("lead_field_")) {
        return LEAD_FIELD_TYPES[fieldKey.slice("lead_field_".length)] ?? "unknown";
    }

    return NATIVE_FIELD_TYPES[fieldKey] ?? "unknown";
}

const OPERATORS_BY_TYPE: Record<FieldValueType, ConditionOperator[]> = {
    number: ["=", ">", "<", "exists", "changed"],
    date: ["=", ">", "<", "exists", "changed"],
    select: ["=", "exists", "changed"],
    string: ["=", "contains", "exists", "changed"],
    file: ["exists", "changed"],
    unknown: ["=", ">", "<", "contains", "exists", "changed"],
};

/** CONDITION_OPERATORS filtered to what actually makes sense for a field's
 * value type — e.g. no "Greater Than"/"Less Than" on a text field. */
export function operatorsForFieldType(type: FieldValueType): { value: ConditionOperator; label: string }[] {
    const allowed = OPERATORS_BY_TYPE[type];
    return CONDITION_OPERATORS.filter((op) => allowed.includes(op.value));
}
