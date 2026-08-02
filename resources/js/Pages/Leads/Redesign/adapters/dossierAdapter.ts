import type { Lead } from "@/Types/api/leads";
import type { DossierFieldKey } from "../config/dossierSections";

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

/**
 * Resolve display values for dossier keys from a Lead (+ related props).
 */
export function getDossierFieldValue(
    lead: Lead,
    key: DossierFieldKey,
): string {
    const l = lead as unknown as Record<string, unknown>;

    switch (key) {
        case "salutation":
            return asString(l.salutation);
        case "mobile":
            return asString(l.mobile_with_phonecode || l.mobile);
        case "email":
            return asString(l.email);
        case "whatsapp":
            return asString(l.whatsapp || l.mobile_with_phonecode || l.mobile);
        case "telegram":
            return asString(l.telegram);
        case "instagram":
            return asString(l.instagram);
        case "contactScore":
            return asString(l.contact_score ?? l.score);
        case "hasAttendedWebinar":
            return yesNo(l.has_attended_webinar ?? l.webinar_attended);
        case "lastWebinarDate":
            return asString(l.last_webinar_date ?? l.last_webinar_at);
        case "hasDownloadedEbook":
            return yesNo(l.has_downloaded_ebook ?? l.ebook_downloaded);
        case "hasJoinedFbGroup":
            return yesNo(l.has_joined_fb_group ?? l.fb_group_joined);
        case "age":
            return formatAgeDisplay(l.age, asString(l.age_range));
        case "nationality":
            return asString(
                (l.nationality as { nicename?: string })?.nicename ||
                    l.nationality,
            );
        case "gender":
            return asString(l.gender);
        case "languages":
            return asString(l.languages);
        case "occupation":
            return asString(l.occupation);
        case "companyName":
            return asString(l.company_name);
        case "city":
            return asString(l.city);
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
                (l.source as { name?: string })?.name || l.source_name,
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
        case "nextFollowUp":
            return asString(l.next_follow_up_date ?? l.next_follow_up);
        default:
            return "";
    }
}

export function countFilledFields(
    lead: Lead,
    keys: DossierFieldKey[],
): { filled: number; total: number } {
    let filled = 0;
    for (const key of keys) {
        if (getDossierFieldValue(lead, key).trim()) filled += 1;
    }
    return { filled, total: keys.length };
}
