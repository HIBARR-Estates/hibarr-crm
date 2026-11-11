import dayjs from "dayjs";
import { computeAgeFieldsFromDateOfBirth } from "@/lib/leadAge";
import { formatMobileForDisplay } from "@/lib/utils";
import { getLeadNativeEditValue } from "@/Pages/Leads/Redesign/adapters/dossierAdapter";
import type { Lead, LeadCategory } from "@/Types/api/leads";
import type { LeadNativeFieldKey } from "@/Pages/Leads/Redesign/config/leadInfoSections";

/**
 * The agent workspace's edit page for a person (canvas L7-09) edits exactly the
 * fields the lead page's own edit dialog does, over the same endpoint
 * (lead-contact.patch). Section grouping follows the board; fields the CRM has
 * no lead column for (marital status, household, finances, wishes) are not here.
 */

export type EditSectionId = "profile" | "contact" | "address" | "source";

export type EditInput = "text" | "tel" | "email" | "select" | "multi" | "date" | "readonly";

/** Where a select's options come from. */
export type EditOptionSet =
    | "salutation"
    | "gender"
    | "temperature"
    | "yes_no"
    | "age_range"
    | "country"
    | "source"
    | "category"
    | "contact_time";

export interface EditField {
    /** The lead column this edits, and the key in the form. */
    key: string;
    /** Lang key under pages.agent_workspace.contact.edit.fields. */
    label: string;
    input: EditInput;
    options?: EditOptionSet;
    /** How the lead page's dialog reads the starting value. */
    native?: LeadNativeFieldKey;
    /** Spans a full row of the grid. */
    wide?: boolean;
}

export interface EditSection {
    id: EditSectionId;
    fields: EditField[];
}

export const EDIT_SECTIONS: EditSection[] = [
    {
        id: "profile",
        fields: [
            { key: "salutation", label: "salutation", input: "select", options: "salutation", native: "salutation" },
            { key: "client_name", label: "name", input: "text", native: "clientName" },
            { key: "gender", label: "gender", input: "select", options: "gender", native: "gender" },
            { key: "date_of_birth", label: "date_of_birth", input: "date", native: "dateOfBirthAndAge" },
            { key: "nationality", label: "nationality", input: "text", native: "nationality" },
            { key: "languages", label: "languages", input: "text", native: "languages" },
            { key: "occupation", label: "occupation", input: "text", native: "occupation" },
            { key: "company_name", label: "company", input: "text", native: "companyName" },
            { key: "preferred_contact_times", label: "preferred_time", input: "multi", options: "contact_time", native: "preferredContactTime" },
            { key: "cell", label: "mobile_2", input: "tel" },
            { key: "temperature", label: "temperature", input: "select", options: "temperature", native: "temperature" },
            { key: "has_joined_the_whatsapp_group", label: "whatsapp_group", input: "select", options: "yes_no", native: "hasJoinedWhatsappGroup" },
            { key: "age_range", label: "age_range", input: "select", options: "age_range" },
            { key: "added_by", label: "added_by", input: "readonly", native: "addedBy" },
        ],
    },
    {
        id: "contact",
        fields: [
            { key: "mobile", label: "mobile", input: "tel", native: "mobile" },
            { key: "office", label: "office", input: "tel", native: "office" },
            { key: "client_email", label: "email", input: "email", native: "email" },
            { key: "client_whatsapp", label: "whatsapp", input: "tel", native: "whatsapp" },
            { key: "client_telegram", label: "telegram", input: "text", native: "telegram" },
            { key: "client_instagram", label: "instagram", input: "text", native: "instagram" },
        ],
    },
    {
        id: "address",
        fields: [
            { key: "address", label: "street", input: "text", native: "address", wide: true },
            { key: "postal_code", label: "postal_code", input: "text", native: "postalCode" },
            { key: "city", label: "city", input: "text", native: "city" },
            { key: "state", label: "state", input: "text", native: "state" },
            { key: "country", label: "country", input: "select", options: "country", native: "country" },
        ],
    },
    {
        id: "source",
        fields: [
            { key: "source_id", label: "source", input: "select", options: "source", native: "source" },
            { key: "category_ids", label: "category", input: "multi", options: "category", native: "category" },
        ],
    },
];

export interface EditOptions {
    salutations: Array<{ value: string; label: string }>;
    ageRanges: Array<{ value: string; label: string }>;
    countries: Array<{ iso: string; nicename: string }>;
    sources: Array<{ id: number; type: string }>;
    categories: LeadCategory[];
}

export type EditForm = Record<string, string>;

const recordOf = (lead: Lead) => lead as unknown as Record<string, unknown>;

/** The lead's own values, as the form holds them (the same reads as the lead page's dialog). */
export function initialEditForm(lead: Lead): EditForm {
    const record = recordOf(lead);
    const form: EditForm = {};
    for (const section of EDIT_SECTIONS) {
        for (const field of section.fields) {
            if (field.input === "readonly") continue;
            if (field.input === "tel") {
                // Numbers are stored as plain text or as the phone input's JSON; edit them as text.
                form[field.key] = formatMobileForDisplay(record[field.key]);
            } else if (field.key === "age_range") {
                form.age_range = String(record.age_range ?? "");
            } else if (field.key === "date_of_birth") {
                form.date_of_birth = typeof record.date_of_birth === "string" ? record.date_of_birth.split("T")[0] : "";
            } else if (field.key === "nationality") {
                const nationality = record.nationality;
                form.nationality =
                    nationality && typeof nationality === "object"
                        ? String((nationality as { nicename?: string }).nicename ?? "")
                        : String(nationality ?? "");
            } else if (field.native) {
                form[field.key] = getLeadNativeEditValue(lead, field.native, field.key);
            }
        }
    }
    return form;
}

export const isFilled = (value: string | undefined) => (value ?? "").trim() !== "";

/** Whether a field counts as changed. Age range follows the date of birth when there is one. */
export function changedKeys(form: EditForm, initial: EditForm): string[] {
    const dobMoved = (form.date_of_birth ?? "") !== (initial.date_of_birth ?? "");
    const keys: string[] = [];
    for (const section of EDIT_SECTIONS) {
        for (const field of section.fields) {
            if (field.input === "readonly") continue;
            if (field.key === "age_range" && dobMoved) continue;
            if ((form[field.key] ?? "") !== (initial[field.key] ?? "")) keys.push(field.key);
        }
    }
    return keys;
}

const list = (raw: string) =>
    raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

/** The PATCH body for the fields that changed, shaped as the lead page's dialog sends them. */
export function buildEditPatch(form: EditForm, initial: EditForm): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const dobMoved = (form.date_of_birth ?? "") !== (initial.date_of_birth ?? "");

    for (const key of changedKeys(form, initial)) {
        const raw = form[key] ?? "";
        switch (key) {
            case "date_of_birth":
                payload.date_of_birth = raw || null;
                break;
            case "languages":
                payload.languages = list(raw);
                break;
            case "preferred_contact_times":
                payload.preferred_contact_times = list(raw);
                break;
            case "category_ids":
                payload.category_ids = list(raw)
                    .map(Number)
                    .filter((id) => Number.isFinite(id) && id > 0);
                break;
            case "source_id":
                payload.source_id = raw ? Number(raw) : null;
                break;
            case "has_joined_the_whatsapp_group":
                payload.has_joined_the_whatsapp_group = raw === "1";
                break;
            default:
                payload[key] = raw.trim() || null;
        }
    }

    if (dobMoved) {
        // A date of birth sets the age and range; clearing it clears them.
        const computed = form.date_of_birth ? computeAgeFieldsFromDateOfBirth(form.date_of_birth) : null;
        payload.age = computed?.age ?? null;
        payload.age_range = computed?.age_range ?? null;
    }

    return payload;
}

/** A stored value as a person reads it: option labels instead of ids, a date as "14 Mar 1988". */
export function readableValue(field: EditField, raw: string | undefined, options: EditOptions, labels: Record<string, string>): string {
    const value = (raw ?? "").trim();
    if (!value) return "";
    if (field.input === "date") {
        const date = dayjs(value);
        return date.isValid() ? date.format("D MMM YYYY") : value;
    }
    switch (field.options) {
        case "salutation":
            return options.salutations.find((item) => item.value === value)?.label ?? value;
        case "age_range":
            return options.ageRanges.find((item) => item.value === value)?.label ?? value;
        case "country":
            return options.countries.find((item) => item.iso === value)?.nicename ?? value;
        case "source":
            return options.sources.find((item) => String(item.id) === value)?.type ?? value;
        case "category":
            return list(value)
                .map((id) => options.categories.find((item) => String(item.id) === id)?.category_name ?? id)
                .join(", ");
        case "contact_time":
            return list(value)
                .map((item) => labels[item] ?? item)
                .join(", ");
        case "gender":
        case "temperature":
        case "yes_no":
            return labels[value] ?? value;
        default:
            return value;
    }
}

/** The lead as it will read after saving, for the key-facts preview. */
export function draftLead(lead: Lead, form: EditForm, options: EditOptions): Lead {
    const draft: Record<string, unknown> = { ...recordOf(lead) };
    const patch = buildEditPatch(form, initialEditForm(lead));
    for (const [key, value] of Object.entries(patch)) draft[key] = value;

    if ("country" in patch) {
        const country = options.countries.find((item) => item.iso === form.country);
        draft.country = country ? { iso: country.iso, nicename: country.nicename } : (patch.country ?? null);
    }
    if ("source_id" in patch) {
        const source = options.sources.find((item) => String(item.id) === form.source_id);
        draft.lead_source = source ? { id: source.id, type: source.type } : null;
        draft.source = null;
    }
    if ("category_ids" in patch) {
        draft.categories = options.categories.filter((item) => list(form.category_ids ?? "").includes(String(item.id)));
    }
    if ("salutation" in patch) draft.salutation_value = patch.salutation ?? null;
    if ("gender" in patch) draft.gender_value = patch.gender ?? null;
    if ("has_joined_the_whatsapp_group" in patch && draft.marketing && typeof draft.marketing === "object") {
        draft.marketing = { ...(draft.marketing as Record<string, unknown>), has_joined_the_whatsapp_group: patch.has_joined_the_whatsapp_group };
    }
    return draft as unknown as Lead;
}
