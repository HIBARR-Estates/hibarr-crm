import type { DossierSectionId } from "../types";

export type DossierFieldKey =
    | "salutation"
    | "mobile"
    | "email"
    | "whatsapp"
    | "telegram"
    | "instagram"
    | "contactScore"
    | "hasAttendedWebinar"
    | "lastWebinarDate"
    | "hasDownloadedEbook"
    | "hasJoinedFbGroup"
    | "age"
    | "nationality"
    | "gender"
    | "languages"
    | "occupation"
    | "companyName"
    | "city"
    | "country"
    | "leadValue"
    | "currency"
    | "source"
    | "category"
    | "addedBy"
    | "nextFollowUp";

export interface DossierFieldDef {
    key: DossierFieldKey;
    label: string;
    /** When empty, render muted italic placeholder. */
    mutedEmpty?: boolean;
    /** Financial lead value gets green tone when set. */
    tone?: "green";
    placeholder?: string;
    /** Age shows `{age} · {range}`. */
    displayWithRange?: boolean;
    /** Maps to a Lead model / patchable attribute when editable. */
    leadField?: string;
}

export interface DossierSectionDef {
    id: DossierSectionId;
    title: string;
    readOnly?: boolean;
    fields: DossierFieldDef[];
}

/** Exact field list from the lead-v2 mockup — do not add model fields it omits. */
export const DOSSIER_SECTIONS: DossierSectionDef[] = [
    {
        id: "contact",
        title: "Contact",
        fields: [
            { key: "salutation", label: "Salutation", leadField: "salutation" },
            { key: "mobile", label: "Mobile", leadField: "mobile" },
            { key: "email", label: "Email", leadField: "email" },
            { key: "whatsapp", label: "WhatsApp", leadField: "whatsapp" },
            {
                key: "telegram",
                label: "Telegram",
                mutedEmpty: true,
                leadField: "telegram",
            },
            {
                key: "instagram",
                label: "Instagram",
                mutedEmpty: true,
                leadField: "instagram",
            },
        ],
    },
    {
        id: "engagement",
        title: "Engagement",
        readOnly: true,
        fields: [
            { key: "contactScore", label: "Contact score" },
            { key: "hasAttendedWebinar", label: "Webinar attended" },
            { key: "lastWebinarDate", label: "Last webinar" },
            { key: "hasDownloadedEbook", label: "Ebook" },
            {
                key: "hasJoinedFbGroup",
                label: "FB group",
                mutedEmpty: true,
            },
        ],
    },
    {
        id: "personal",
        title: "Personal",
        fields: [
            {
                key: "age",
                label: "Age",
                displayWithRange: true,
                leadField: "age",
            },
            { key: "nationality", label: "Nationality", leadField: "nationality" },
            { key: "gender", label: "Gender", leadField: "gender" },
            { key: "languages", label: "Languages", leadField: "languages" },
            { key: "occupation", label: "Occupation", leadField: "occupation" },
            {
                key: "companyName",
                label: "Company",
                leadField: "company_name",
            },
            { key: "city", label: "City", leadField: "city" },
            { key: "country", label: "Country", leadField: "country" },
        ],
    },
    {
        id: "financial",
        title: "Financial",
        fields: [
            {
                key: "leadValue",
                label: "Lead value",
                tone: "green",
                placeholder: "Not set",
                leadField: "value",
            },
            { key: "currency", label: "Currency", leadField: "currency_id" },
        ],
    },
    {
        id: "attribution",
        title: "Attribution",
        fields: [
            { key: "source", label: "Source", leadField: "source_id" },
            { key: "category", label: "Category", leadField: "category_id" },
            { key: "addedBy", label: "Added by" },
            {
                key: "nextFollowUp",
                label: "Next follow-up",
                leadField: "next_follow_up_date",
            },
        ],
    },
];
