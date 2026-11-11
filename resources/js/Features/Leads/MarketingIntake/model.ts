import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { buildFieldValueMap } from "@/lib/customFieldValueMap";
import { computeAgeFieldsFromDateOfBirth, computeAgeRangeFromAge } from "@/lib/leadAge";
import type {
    MarketingCustomField,
    MarketingLeadDraft,
    MarketingLeadOptions,
    StepId,
    StepModel,
} from "./types";

/** Custom field types this flow can enter. Others are added on the lead page after saving. */
export const SUPPORTED_CUSTOM_FIELD_TYPES = new Set([
    "text",
    "textarea",
    "password",
    "number",
    "currency",
    "phone",
    "email",
    "url",
    "select",
    "radio",
    "checkbox",
    "multiselect",
    "date",
    "country",
    "multiSelectCountry",
]);

export const MULTI_VALUE_CUSTOM_FIELD_TYPES = new Set(["checkbox", "multiselect", "multiSelectCountry"]);

let noteSeq = 0;
export function newNoteKey(): string {
    noteSeq += 1;
    return `note-${Date.now()}-${noteSeq}`;
}

export function emptyDraft(): MarketingLeadDraft {
    return {
        salutation: "",
        client_name: "",
        client_email: "",
        mobile_country: "",
        mobile_number: "",
        cell: "",
        office: "",
        preferred_contact_times: [],
        source_id: "",
        category_ids: [],
        gender: "",
        date_of_birth: "",
        age: "",
        age_range: "",
        nationality: "",
        languages: [],
        occupation: "",
        company_name: "",
        website: "",
        temperature: "",
        address: "",
        postal_code: "",
        city: "",
        state: "",
        country: "",
        custom_fields_data: {},
        notes: [{ key: newNoteKey(), title: "", details: "" }],
    };
}

export function isFilled(value: unknown): boolean {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim() !== "";
    return true;
}

/** Option values stored on a custom field definition (JSON string or array). */
export function customFieldOptions(field: MarketingCustomField): string[] {
    let raw: unknown = field.values;
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch {
            raw = [];
        }
    }
    if (!Array.isArray(raw)) return [];
    return raw.map((value) => String(value ?? "").trim()).filter((value) => value !== "");
}

function byDisplayOrder(a: MarketingCustomField, b: MarketingCustomField): number {
    const orderA = a.display_order ?? a.field_order ?? 0;
    const orderB = b.display_order ?? b.field_order ?? 0;
    return orderA - orderB || a.id - b.id;
}

/**
 * Field id → visible, from the custom fields' own visibility rules evaluated
 * against what has been typed so far. Same evaluator as the regular lead form.
 */
export function customFieldVisibility(
    fields: MarketingCustomField[],
    values: Record<string, unknown>,
): Record<number, boolean> {
    if (fields.length === 0) return {};
    return evaluateAllFieldsVisibility(
        fields,
        buildFieldValueMap({ customFieldsData: values, fields, normalizeMultiSelect: true }),
    );
}

const CONTACT_KEYS: Array<keyof MarketingLeadDraft> = [
    "salutation",
    "client_name",
    "client_email",
    "mobile_number",
    "cell",
    "office",
    "preferred_contact_times",
    "source_id",
    "category_ids",
];
const PROFILE_KEYS: Array<keyof MarketingLeadDraft> = [
    "gender",
    "date_of_birth",
    "age_range",
    "nationality",
    "languages",
    "occupation",
    "company_name",
    "website",
    "temperature",
];
const ADDRESS_KEYS: Array<keyof MarketingLeadDraft> = ["address", "postal_code", "city", "state", "country"];

function countFilled(draft: MarketingLeadDraft, keys: Array<keyof MarketingLeadDraft>): number {
    return keys.filter((key) => isFilled(draft[key])).length;
}

/**
 * The modal's steps: three fixed ones, one per custom field category that has
 * a visible field (in the categories' settings order), fields without a
 * category under "More details", then notes.
 */
export function buildSteps(
    draft: MarketingLeadDraft,
    options: MarketingLeadOptions | null,
    visibility: Record<number, boolean>,
    labels: { contact: string; profile: string; address: string; other: string; notes: string },
): StepModel[] {
    const steps: StepModel[] = [
        { id: "contact", label: labels.contact, filled: countFilled(draft, CONTACT_KEYS), total: CONTACT_KEYS.length },
        { id: "profile", label: labels.profile, filled: countFilled(draft, PROFILE_KEYS), total: PROFILE_KEYS.length },
        { id: "address", label: labels.address, filled: countFilled(draft, ADDRESS_KEYS), total: ADDRESS_KEYS.length },
    ];

    if (options) {
        const visible = options.customFields
            .filter((field) => visibility[field.id] !== false)
            .sort(byDisplayOrder);
        const categoryIds = new Set(options.customFieldCategories.map((category) => category.id));

        const stepFor = (fields: MarketingCustomField[]) => ({
            fields,
            filled: fields.filter((field) => isFilled(draft.custom_fields_data[`field_${field.id}`])).length,
            total: fields.filter((field) => SUPPORTED_CUSTOM_FIELD_TYPES.has(field.type)).length,
        });

        for (const category of options.customFieldCategories) {
            const fields = visible.filter((field) => field.custom_field_category_id === category.id);
            if (fields.length === 0) continue;
            steps.push({
                id: `custom_${category.id}` as StepId,
                label: category.name,
                dynamicLabel: true,
                ...stepFor(fields),
            });
        }

        const uncategorised = visible.filter(
            (field) => field.custom_field_category_id == null || !categoryIds.has(field.custom_field_category_id),
        );
        if (uncategorised.length > 0) {
            steps.push({ id: "custom_other", label: labels.other, ...stepFor(uncategorised) });
        }
    }

    steps.push({
        id: "notes",
        label: labels.notes,
        filled: draft.notes.filter((note) => isFilled(note.details)).length,
        total: 0,
    });

    return steps;
}

/** Which step a server validation key belongs to, so the modal can jump there. */
export function stepForErrorKey(key: string, steps: StepModel[]): StepId {
    if (key.startsWith("notes")) return "notes";
    if (key.startsWith("custom_fields_data.")) {
        const id = Number(key.split(".")[1]?.replace("field_", ""));
        const step = steps.find((candidate) => candidate.fields?.some((field) => field.id === id));
        if (step) return step.id;
    }
    if (ADDRESS_KEYS.includes(key as keyof MarketingLeadDraft)) return "address";
    if (
        PROFILE_KEYS.includes(key as keyof MarketingLeadDraft) ||
        key.startsWith("languages") ||
        key === "age"
    ) {
        return "profile";
    }
    return "contact";
}

/** Age and age range follow the date of birth, as on the regular lead form. */
export function withDerivedAge(draft: MarketingLeadDraft): Pick<MarketingLeadDraft, "age" | "age_range"> {
    if (draft.date_of_birth) {
        const { age, age_range } = computeAgeFieldsFromDateOfBirth(draft.date_of_birth);
        return { age: age != null ? String(age) : "", age_range: age_range ?? "" };
    }
    if (draft.age !== "") {
        return { age: draft.age, age_range: computeAgeRangeFromAge(Number(draft.age)) ?? draft.age_range };
    }
    return { age: "", age_range: draft.age_range };
}

/** The POST body. Hidden custom fields (visibility rules) are dropped, never sent. */
export function buildPayload(
    draft: MarketingLeadDraft,
    options: MarketingLeadOptions | null,
    visibility: Record<number, boolean>,
): Record<string, unknown> {
    const nullable = (value: string) => (value.trim() === "" ? null : value.trim());
    const country = options?.countries.find((candidate) => candidate.iso === draft.mobile_country);
    const digits = draft.mobile_number.replace(/\D+/g, "");

    const customFields: Record<string, unknown> = {};
    for (const field of options?.customFields ?? []) {
        if (visibility[field.id] === false || !SUPPORTED_CUSTOM_FIELD_TYPES.has(field.type)) continue;
        const key = `field_${field.id}`;
        const value = draft.custom_fields_data[key];
        if (isFilled(value)) customFields[key] = value;
    }

    return {
        salutation: nullable(draft.salutation),
        client_name: draft.client_name.trim(),
        client_email: nullable(draft.client_email),
        mobile:
            digits === ""
                ? null
                : {
                      countryCode: country?.phonecode != null ? Number(country.phonecode) : null,
                      areaCode: "",
                      phoneNumber: digits,
                      isoCode: country?.iso?.toLowerCase() ?? null,
                  },
        cell: nullable(draft.cell),
        office: nullable(draft.office),
        preferred_contact_times: draft.preferred_contact_times,
        source_id: draft.source_id ? Number(draft.source_id) : null,
        category_ids: draft.category_ids.map(Number),
        gender: nullable(draft.gender),
        date_of_birth: nullable(draft.date_of_birth),
        age: draft.age === "" ? null : Number(draft.age),
        age_range: nullable(draft.age_range),
        nationality: nullable(draft.nationality),
        languages: draft.languages,
        occupation: nullable(draft.occupation),
        company_name: nullable(draft.company_name),
        website: nullable(draft.website),
        temperature: nullable(draft.temperature),
        address: nullable(draft.address),
        postal_code: nullable(draft.postal_code),
        city: nullable(draft.city),
        state: nullable(draft.state),
        country: nullable(draft.country),
        custom_fields_data: customFields,
        notes: draft.notes
            .filter((note) => note.details.trim() !== "")
            .map((note) => ({ title: nullable(note.title), details: note.details.trim() })),
    };
}
