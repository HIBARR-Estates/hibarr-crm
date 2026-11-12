import type { CustomField } from "@/Types";

export interface Option {
    value: string;
    label: string;
}

export interface CountryOption {
    iso: string | null;
    nicename: string | null;
    phonecode: number | string | null;
}

export interface MarketingCustomField extends CustomField {
    custom_field_category_id?: number | null;
}

export interface MarketingCustomFieldCategory {
    id: number;
    name: string;
}

/** GET marketing-leads/options — everything the steps need, fetched on open. */
export interface MarketingLeadOptions {
    salutations: Option[];
    genders: Option[];
    temperatures: Option[];
    preferredContactTimes: Option[];
    ageRanges: Option[];
    languages: Array<{ id: number; language_name: string; language_code: string }>;
    countries: CountryOption[];
    sources: Array<{ id: number; type: string }>;
    categories: Array<{ id: number; category_name: string }>;
    customFields: MarketingCustomField[];
    customFieldCategories: MarketingCustomFieldCategory[];
    /** People who can own a lead (user ids). */
    owners: Array<{ id: number; name: string }>;
    /** Owner picked in Lead settings for this flow; null = none. */
    defaultOwnerId: number | null;
}

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_audience"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

/** UTM fields whose options OL manages (pick-only); the rest are free text. */
export const OL_UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;
export type OlUtmKey = (typeof OL_UTM_KEYS)[number];
export const isOlUtmKey = (key: UtmKey): key is OlUtmKey => (OL_UTM_KEYS as readonly string[]).includes(key);

/** A UTM option managed on OL; `leadSourceId` links a source to a CRM lead source. */
export interface UtmConfigOption {
    value: string;
    label: string;
    leadSourceId: number | null;
}

export interface MarketingLeadNoteDraft {
    key: string;
    title: string;
    details: string;
}

/** Every value the flow collects. Origin is never part of it: the server stamps it. */
export interface MarketingLeadDraft {
    salutation: string;
    client_name: string;
    client_email: string;
    /** "+<country><number>", as the lead page phone input produces it. */
    mobile: string;
    cell: string;
    office: string;
    preferred_contact_times: string[];
    source_id: string;
    category_ids: string[];
    /** User id; starts as the owner picked in settings. */
    lead_owner: string;
    /** First-touch UTM values. */
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_content: string;
    utm_term: string;
    utm_audience: string;
    gender: string;
    date_of_birth: string;
    age: string;
    age_range: string;
    nationality: string;
    languages: string[];
    occupation: string;
    company_name: string;
    website: string;
    temperature: string;
    address: string;
    postal_code: string;
    city: string;
    state: string;
    country: string;
    custom_fields_data: Record<string, unknown>;
    notes: MarketingLeadNoteDraft[];
}

/** A lead saved while the modal stayed open ("Save and add another"). */
export interface SavedMarketingLead {
    id: number;
    client_name: string;
    client_email: string | null;
    url: string;
}

export type StepId = "contact" | "attribution" | "profile" | "address" | "notes" | `custom_${number}` | "custom_other";

export interface StepModel {
    id: StepId;
    label: string;
    /** Server-provided names (custom field categories) go through td(). */
    dynamicLabel?: boolean;
    filled: number;
    total: number;
    /** Custom fields shown on this step, after visibility rules. */
    fields?: MarketingCustomField[];
}
