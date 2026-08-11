import type { Lead } from "@/Types/api/leads";
import type { DossierFieldKey } from "../config/dossierSections";
import type { LeadNativeFieldKey } from "../config/leadInfoSections";
import {
    computeAgeRangeFromAge,
    formatLeadAgeDisplay,
    resolveLeadAgeFields,
} from "@/lib/leadAge";
import { resolveLeadPhoneDisplay } from "@/lib/utils";
import {
    resolveCurrencyDisplay,
    type CurrencyDisplay,
} from "./currencyAdapter";

/** Values that should render as empty (no copy, not "filled"). */
const EMPTY_VALUE_MARKERS = new Set([
    "",
    "-",
    "—",
    "–",
    "--",
    "...",
    "n/a",
    "na",
    "none",
    "null",
    "undefined",
    "not set",
    "[object object]",
]);

/** Whether a dossier display string is real content (not placeholder / junk). */
export function isMeaningfulDossierValue(
    value: string | null | undefined,
): boolean {
    if (value == null) return false;
    const trimmed = String(value).trim();
    if (!trimmed) return false;
    return !EMPTY_VALUE_MARKERS.has(trimmed.toLowerCase());
}

/** @deprecated Prefer computeAgeRangeFromAge from @/lib/leadAge */
export function ageRangeFromAge(age: unknown): string {
    return (
        computeAgeRangeFromAge(
            age === null || age === undefined || age === ""
                ? null
                : Number(age),
        ) ?? ""
    );
}

export function formatAgeDisplay(age: unknown, ageRange?: string): string {
    return (
        formatLeadAgeDisplay({
            dateOfBirth: null,
            age:
                age === null || age === undefined || age === ""
                    ? null
                    : Number(age),
            ageRange: ageRange ?? null,
        }) ?? ""
    );
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
    if (Array.isArray(value)) {
        return value
            .map(String)
            .map((s) => s.trim())
            .filter(Boolean)
            .join(", ");
    }
    if (typeof value === "object") {
        if ("name" in value) {
            return String((value as { name?: unknown }).name ?? "").trim();
        }
        // Avoid "[object Object]" cluttering empty dossier rows (e.g. bare phone blobs).
        return "";
    }
    const raw = String(value).trim();
    if (
        raw === "" ||
        raw === "null" ||
        raw === "undefined" ||
        raw.toLowerCase() === "[object object]"
    ) {
        return "";
    }
    return raw;
}

function asPhone(raw: unknown, formatted?: unknown): string {
    return resolveLeadPhoneDisplay(raw, formatted);
}

function marketingOf(lead: Lead): Record<string, unknown> {
    const marketing = (
        lead as unknown as { marketing?: Record<string, unknown> }
    ).marketing;
    return marketing ?? {};
}

type AnyFieldKey = DossierFieldKey | LeadNativeFieldKey;

export interface DossierFieldOptions {
    companyCurrency?: CurrencyDisplay | null;
}

/**
 * Resolve display values for dossier / lead-info native field keys.
 */
export function getDossierFieldValue(
    lead: Lead,
    key: AnyFieldKey,
    options?: DossierFieldOptions,
): string {
    const l = lead as unknown as Record<string, unknown>;
    const m = marketingOf(lead);

    switch (key) {
        case "clientName":
            return asString(l.client_name);
        case "salutation":
            return asString(l.salutation_value ?? l.salutation);
        case "mobile":
            return asPhone(l.mobile, l.mobile_with_phonecode);
        case "office":
            return asPhone(l.office, l.office_phone_formatted);
        case "email":
            return asString(l.client_email ?? l.email);
        case "whatsapp":
            return asPhone(l.client_whatsapp ?? l.whatsapp);
        case "telegram":
            return asString(l.client_telegram ?? l.telegram);
        case "instagram":
            return asString(l.client_instagram ?? l.instagram);
        case "contactScore":
            return asString(m.contact_score ?? l.contact_score ?? l.score);
        case "hasRegisteredWebinar":
            return yesNo(
                m.has_registered_for_the_webinar ??
                    l.has_registered_for_the_webinar,
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
                m.has_joined_the_whatsapp_group ??
                    l.has_joined_the_whatsapp_group,
            );
        case "dateOfBirthAndAge": {
            const resolved = resolveLeadAgeFields({
                dateOfBirth: asString(l.date_of_birth) || null,
                age:
                    l.age === null || l.age === undefined
                        ? null
                        : Number(l.age),
                ageRange: asString(l.age_range) || null,
            });
            return (
                formatLeadAgeDisplay(resolved) ??
                formatAgeDisplay(l.age, asString(l.age_range))
            );
        }
        case "nationality":
            return asString(
                (l.nationality as { nicename?: string })?.nicename ||
                    l.nationality,
            );
        case "gender":
            return asString(l.gender_value ?? l.gender);
        case "temperature": {
            const value = asString(l.temperature);
            return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
        }
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
            return resolveCurrencyDisplay(
                (l.currency as
                    | {
                          currency_code?: string;
                          currency_symbol?: string;
                          code?: string;
                      }
                    | undefined) ??
                    (l.currency_code as string | undefined) ??
                    (l.currency as string | undefined),
                options?.companyCurrency,
            ).code;
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
        case "category": {
            const multi = l.categories as
                | Array<{ category_name?: string; name?: string }>
                | undefined;
            if (Array.isArray(multi) && multi.length > 0) {
                return multi
                    .map(
                        (c) =>
                            c.category_name || c.name || "",
                    )
                    .filter(Boolean)
                    .join(", ");
            }
            return asString(
                (l.category as { category_name?: string; name?: string })
                    ?.category_name ||
                    (l.category as { name?: string })?.name ||
                    l.category_name,
            );
        }
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
        if (isMeaningfulDossierValue(getDossierFieldValue(lead, key))) {
            filled += 1;
        }
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
    if (key === "hasJoinedWhatsappGroup") {
        const joined =
            lead.marketing?.has_joined_the_whatsapp_group ??
            record.has_joined_the_whatsapp_group;
        return joined ? "1" : "0";
    }
    if (key === "dateOfBirthAndAge") {
        return String(record.date_of_birth ?? record.age ?? "");
    }
    if (key === "languages") {
        const languages = record.languages;
        return Array.isArray(languages)
            ? languages.map(String).filter(Boolean).join(", ")
            : String(languages ?? "");
    }
    if (key === "source") return String(record.source_id ?? "");
    if (key === "category") {
        const categories = record.categories;
        if (Array.isArray(categories) && categories.length > 0) {
            return categories
                .map((c) =>
                    typeof c === "object" && c && "id" in c
                        ? String((c as { id: number }).id)
                        : String(c),
                )
                .filter(Boolean)
                .join(",");
        }
        const ids = record.category_ids;
        if (Array.isArray(ids) && ids.length > 0) {
            return ids.map(String).join(",");
        }
        return String(record.category_id ?? "");
    }
    if (key === "currency") return String(record.currency_id ?? "");
    if (key === "leadValue") return String(record.value ?? "");
    if (key === "gender") {
        return String(record.gender_value ?? record.gender ?? "");
    }
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
