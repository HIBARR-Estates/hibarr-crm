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
import { UTM_KEYS } from "./types";

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

/** A blank lead; the owner starts as the one picked in settings for this flow. */
export function emptyDraft(defaultOwnerId: number | null = null): MarketingLeadDraft {
    return {
        salutation: "",
        client_name: "",
        client_email: "",
        mobile: "",
        cell: "",
        office: "",
        preferred_contact_times: [],
        source_id: "",
        category_ids: [],
        lead_owner: defaultOwnerId != null ? String(defaultOwnerId) : "",
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
        utm_content: "",
        utm_term: "",
        utm_audience: "",
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
    "mobile",
    "cell",
    "office",
    "preferred_contact_times",
];
const ATTRIBUTION_KEYS: Array<keyof MarketingLeadDraft> = [
    "source_id",
    "category_ids",
    "lead_owner",
    ...UTM_KEYS,
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
    labels: { contact: string; attribution: string; profile: string; address: string; other: string; notes: string },
): StepModel[] {
    const steps: StepModel[] = [
        { id: "contact", label: labels.contact, filled: countFilled(draft, CONTACT_KEYS), total: CONTACT_KEYS.length },
        {
            id: "attribution",
            label: labels.attribution,
            filled: countFilled(draft, ATTRIBUTION_KEYS),
            total: ATTRIBUTION_KEYS.length,
        },
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
    if (key.startsWith("utm") || ATTRIBUTION_KEYS.includes(key as keyof MarketingLeadDraft)) return "attribution";
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
    // A dial code on its own ("+49") is not a number yet.
    const phone = (value: string) => (value.replace(/\D+/g, "").length < 6 ? null : value.trim());

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
        mobile: phone(draft.mobile),
        cell: phone(draft.cell),
        office: phone(draft.office),
        preferred_contact_times: draft.preferred_contact_times,
        source_id: draft.source_id ? Number(draft.source_id) : null,
        category_ids: draft.category_ids.map(Number),
        lead_owner: draft.lead_owner ? Number(draft.lead_owner) : null,
        utm: Object.fromEntries(UTM_KEYS.map((key) => [key, nullable(draft[key])])),
        gender: nullable(draft.gender),
        date_of_birth: nullable(draft.date_of_birth),
        age: draft.age === "" ? null : Number(draft.age),
        age_range: nullable(draft.age_range),
        nationality: nullable(draft.nationality),
        languages: draft.languages,
        occupation: nullable(draft.occupation),
        company_name: nullable(draft.company_name),
        website: normalizeWebsite(draft.website),
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

/**
 * A website as typed ("hibarr.de", "www.x.com/path") with https:// added when
 * no scheme was given; null when empty.
 */
export function normalizeWebsite(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** True for an empty value, or an http(s) address with a real domain and no spaces. */
export function isValidWebsite(value: string): boolean {
    const normalized = normalizeWebsite(value);
    if (normalized === null) return true;
    if (/\s/.test(normalized)) return false;
    try {
        const url = new URL(normalized);
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        const labels = url.hostname.split(".");
        return (
            labels.length >= 2 &&
            labels.every((label) => /^[a-z0-9-]+$/i.test(label)) &&
            /^(xn--[a-z0-9-]+|[a-z]{2,})$/i.test(labels[labels.length - 1])
        );
    } catch {
        return false;
    }
}

type Choice = { value: string; label: string };

const normalizeQuery = (text: string) =>
    text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();

/**
 * Select search for the modal: an option matches when its label, or one of its
 * words, starts with what was typed ("en" finds English, not Slovenian).
 */
export function matchChoice(input: string, option?: { label?: unknown }): boolean {
    const query = normalizeQuery(input);
    if (query === "") return true;
    const label = normalizeQuery(String(option?.label ?? ""));
    return label.startsWith(query) || label.split(/[\s()/,+-]+/).some((word) => word.startsWith(query));
}

/** Orders matches so labels that start with the query come first, then A–Z. */
export function sortChoices(input: string) {
    const query = normalizeQuery(input);
    return (a: { label?: unknown }, b: { label?: unknown }): number => {
        const la = normalizeQuery(String(a.label ?? ""));
        const lb = normalizeQuery(String(b.label ?? ""));
        const ra = query && la.startsWith(query) ? 0 : 1;
        const rb = query && lb.startsWith(query) ? 0 : 1;
        return ra - rb || la.localeCompare(lb);
    };
}

/**
 * Languages from settings, one option per name: settings can hold the same
 * language under several codes (e.g. en, en-GB, eng), which showed English
 * several times.
 */
export function languageChoices(
    languages: Array<{ language_code: string; language_name: string }>,
    selected: string[],
): Choice[] {
    const byName = new Map<string, Choice>();
    for (const language of languages) {
        const name = String(language.language_name ?? "").trim();
        if (!name || !language.language_code) continue;
        const key = name.toLowerCase();
        const existing = byName.get(key);
        // Keep a code the draft already uses, otherwise the first one listed.
        if (!existing || (selected.includes(language.language_code) && !selected.includes(existing.value))) {
            byName.set(key, { value: language.language_code, label: name });
        }
    }
    return [...byName.values()].sort((a, b) => a.label.localeCompare(b.label));
}
