import type { Lead } from "@/Types/api/leads";
import type { DossierFieldKey } from "../config/dossierSections";
import type { LeadNativeFieldKey } from "../config/leadInfoSections";

const AGE_RANGES = [
    { id: "18-24", min: 18, max: 24 },
    { id: "25-34", min: 25, max: 34 },
    { id: "35-44", min: 35, max: 44 },
    { id: "45-54", min: 45, max: 54 },
    { id: "55-64", min: 55, max: 64 },
    { id: "65+", min: 65, max: 200 },
];

export function ageRangeFromAge(age: unknown): string {
    const n = Number(age);
    if (!Number.isFinite(n) || n <= 0) return "";
    return AGE_RANGES.find((r) => n >= r.min && n <= r.max)?.id || "";
}

export function formatAgeDisplay(age: unknown, ageRange?: string): string {
    if (age === null || age === undefined || age === "") return "";
    const range = ageRange || ageRangeFromAge(age);
    return range ? `${age} · ${range}` : String(age);
}

function yesNo(value: unknown): string {
    if (value === true || value === 1 || value === "1" || value === "Yes") {
        return "Yes";
    }
    if (value === false || value === 0 || value === "0" || value === "No") {
        return "No";
    }
    if (value == null || value === "") return "";
    return String(value);
}

function asString(value: unknown): string {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
    if (typeof value === "object" && value !== null && "name" in value) {
        return String((value as { name?: unknown }).name ?? "");
    }
    return String(value);
}

function marketingOf(lead: Lead): Record<string, unknown> {
    const marketing = (lead as unknown as { marketing?: Record<string, unknown> })
        .marketing;
    return marketing ?? {};
}

type AnyFieldKey = DossierFieldKey | LeadNativeFieldKey;

/**
 * Resolve display values for dossier / lead-info native field keys.
 */
export function getDossierFieldValue(lead: Lead, key: AnyFieldKey): string {
    const l = lead as unknown as Record<string, unknown>;
    const m = marketingOf(lead);

    switch (key) {
        case "clientName":
            return asString(l.client_name);
        case "salutation":
            return asString(l.salutation_value ?? l.salutation);
        case "mobile":
            return asString(l.mobile_with_phonecode || l.mobile);
        case "office":
            return asString(l.office_phone_formatted || l.office);
        case "email":
            return asString(l.client_email ?? l.email);
        case "whatsapp":
            return asString(l.client_whatsapp || l.whatsapp);
        case "telegram":
            return asString(l.client_telegram ?? l.telegram);
        case "instagram":
            return asString(l.client_instagram ?? l.instagram);
        case "contactScore":
            return asString(m.contact_score ?? l.contact_score ?? l.score);
        case "hasRegisteredWebinar":
            return yesNo(
                m.has_registered_for_the_webinar ?? l.has_registered_for_the_webinar,
            );
        case "hasAttendedWebinar":
            return yesNo(
                m.has_attended_the_webinar ??
                    l.has_attended_webinar ??
                    l.webinar_attended,
            );
        case "lastWebinarDate":
            return asString(
                m.last_webinar_date ?? l.last_webinar_date ?? l.last_webinar_at,
            );
        case "hasDownloadedEbook":
            return yesNo(
                m.has_downloaded_the_ebook ??
                    l.has_downloaded_ebook ??
                    l.ebook_downloaded,
            );
        case "hasJoinedFbGroup":
            return yesNo(
                m.has_joined_the_facebook_group ??
                    l.has_joined_fb_group ??
                    l.fb_group_joined,
            );
        case "hasJoinedWhatsappGroup":
            return yesNo(
                m.has_joined_the_whatsapp_group ?? l.has_joined_the_whatsapp_group,
            );
        case "age":
            return formatAgeDisplay(l.age, asString(l.age_range));
        case "nationality":
            return asString(
                (l.nationality as { nicename?: string })?.nicename ||
                    l.nationality,
            );
        case "gender":
            return asString(l.gender_value ?? l.gender);
        case "languages":
            return asString(l.languages);
        case "occupation":
            return asString(l.occupation);
        case "companyName":
            return asString(l.company_name);
        case "address":
            return asString(l.address);
        case "postalCode":
            return asString(l.postal_code);
        case "city":
            return asString(l.city);
        case "state":
            return asString(l.state);
        case "country":
            return asString(
                (l.country as { nicename?: string })?.nicename || l.country,
            );
        case "leadValue":
            return asString(l.value ?? l.lead_value);
        case "currency":
            return asString(
                (l.currency as { currency_code?: string; code?: string })
                    ?.currency_code ||
                    (l.currency as { code?: string })?.code ||
                    l.currency_code ||
                    l.currency,
            );
        case "source":
            return asString(
                (l.lead_source as { type?: string; name?: string })?.type ||
                    (l.leadSource as { type?: string; name?: string })?.type ||
                    (l.lead_source as { name?: string })?.name ||
                    (l.leadSource as { name?: string })?.name ||
                    (l.source as { type?: string; name?: string })?.type ||
                    (l.source as { name?: string })?.name ||
                    l.source_name,
            );
        case "category":
            return asString(
                (l.category as { category_name?: string; name?: string })
                    ?.category_name ||
                    (l.category as { name?: string })?.name ||
                    l.category_name,
            );
        case "addedBy":
            return asString(
                (l.added_by as { name?: string })?.name ||
                    (l.creator as { name?: string })?.name ||
                    l.added_by_name,
            );
        default:
            return "";
    }
}

export function countFilledFields(
    lead: Lead,
    keys: AnyFieldKey[],
): { filled: number; total: number } {
    let filled = 0;
    for (const key of keys) {
        if (getDossierFieldValue(lead, key).trim()) filled += 1;
    }
    return { filled, total: keys.length };
}

/** Raw edit value for patch payloads (IDs / plain strings, not display labels). */
export function getLeadNativeEditValue(
    lead: Lead,
    key: LeadNativeFieldKey,
    leadField?: string,
): string {
    const record = lead as unknown as Record<string, unknown>;

    if (key === "clientName") return String(record.client_name ?? "");
    if (key === "email") return String(record.client_email ?? "");
    if (key === "age") return String(record.age ?? "");
    if (key === "languages") {
        const languages = record.languages;
        return Array.isArray(languages)
            ? languages.map(String).filter(Boolean).join(", ")
            : String(languages ?? "");
    }
    if (key === "source") return String(record.source_id ?? "");
    if (key === "category") return String(record.category_id ?? "");
    if (key === "currency") return String(record.currency_id ?? "");
    if (key === "leadValue") return String(record.value ?? "");
    if (key === "gender") return String(record.gender_value ?? record.gender ?? "");
    if (key === "salutation") {
        return String(record.salutation ?? "");
    }
    if (key === "country") {
        const country = record.country;
        if (country && typeof country === "object" && "iso" in country) {
            return String((country as { iso?: string }).iso ?? "");
        }
        return String(country ?? "");
    }
    if (leadField) return String(record[leadField] ?? "");
    return getDossierFieldValue(lead, key);
}
