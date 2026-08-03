import type { LeadInfoCoreSectionId } from "../types";

export type LeadNativeFieldKey =
    | "clientName"
    | "salutation"
    | "mobile"
    | "office"
    | "email"
    | "whatsapp"
    | "telegram"
    | "instagram"
    | "age"
    | "nationality"
    | "gender"
    | "languages"
    | "occupation"
    | "companyName"
    | "address"
    | "postalCode"
    | "city"
    | "state"
    | "country"
    | "leadValue"
    | "currency"
    | "source"
    | "category"
    | "addedBy";

export interface LeadNativeFieldDef {
    key: LeadNativeFieldKey;
    label: string;
    leadField?: string;
    readOnly?: boolean;
}

export interface LeadInfoSectionDef {
    id: LeadInfoCoreSectionId;
    title: string;
    subtitle: string;
    icon: string;
    fields: LeadNativeFieldDef[];
}

/**
 * Lead info section metadata + field inventory.
 * Contact + attribution fields live in Profile; custom categories stay separate.
 */
export const LEAD_INFO_CORE_SECTIONS: LeadInfoSectionDef[] = [
    {
        id: "personal",
        title: "Profile",
        subtitle:
            "Click any field to edit, or switch the whole section into edit mode",
        icon: "user",
        fields: [
            { key: "clientName", label: "Lead name", leadField: "client_name" },
            { key: "salutation", label: "Salutation", leadField: "salutation" },
            { key: "mobile", label: "Mobile", leadField: "mobile" },
            { key: "office", label: "Office phone", leadField: "office" },
            { key: "email", label: "Email", leadField: "client_email" },
            { key: "whatsapp", label: "WhatsApp", leadField: "client_whatsapp" },
            { key: "telegram", label: "Telegram", leadField: "client_telegram" },
            { key: "instagram", label: "Instagram", leadField: "client_instagram" },
            { key: "age", label: "Age", leadField: "age" },
            { key: "nationality", label: "Nationality", leadField: "nationality" },
            { key: "gender", label: "Gender", leadField: "gender" },
            { key: "languages", label: "Languages", leadField: "languages" },
            { key: "occupation", label: "Occupation", leadField: "occupation" },
            { key: "companyName", label: "Company", leadField: "company_name" },
            { key: "address", label: "Street address", leadField: "address" },
            { key: "postalCode", label: "Postal code", leadField: "postal_code" },
            { key: "city", label: "City", leadField: "city" },
            { key: "state", label: "State", leadField: "state" },
            { key: "country", label: "Country", leadField: "country" },
            { key: "source", label: "Source", leadField: "source_id" },
            { key: "category", label: "Category", leadField: "category_id" },
            { key: "addedBy", label: "Added by", readOnly: true },
        ],
    },
];

export const LEAD_INFO_CORE_SECTION_IDS: LeadInfoCoreSectionId[] =
    LEAD_INFO_CORE_SECTIONS.map((section) => section.id);

export function isLeadInfoCoreSection(
    section: string,
): section is LeadInfoCoreSectionId {
    return (LEAD_INFO_CORE_SECTION_IDS as string[]).includes(section);
}

export function getLeadInfoSection(
    id: LeadInfoCoreSectionId,
): LeadInfoSectionDef | undefined {
    return LEAD_INFO_CORE_SECTIONS.find((section) => section.id === id);
}
