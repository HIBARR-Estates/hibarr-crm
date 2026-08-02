import type { DossierSectionId } from "../types";

/** High-signal glance keys shown in the dossier rail. */
export type DossierFieldKey =
    | "mobile"
    | "email"
    | "source"
    | "category"
    | "leadValue"
    | "contactScore"
    | "hasAttendedWebinar"
    | "lastWebinarDate"
    | "hasDownloadedEbook"
    | "hasJoinedFbGroup"
    | "hasJoinedWhatsappGroup"
    | "hasRegisteredWebinar";

export interface DossierFieldDef {
    key: DossierFieldKey;
    label: string;
    mutedEmpty?: boolean;
    tone?: "green";
    placeholder?: string;
}

export interface DossierSectionDef {
    id: DossierSectionId;
    title: string;
    /** Default open on first paint. */
    defaultOpen?: boolean;
    /** When false, values are display-only (no click-to-copy). */
    copyable?: boolean;
    fields: DossierFieldDef[];
}

/**
 * Dossier is a read-only snapshot of the most important lead signals.
 * Editable profile fields live under Lead info.
 */
export const DOSSIER_SECTIONS: DossierSectionDef[] = [
    {
        id: "overview",
        title: "Overview",
        defaultOpen: true,
        fields: [
            { key: "mobile", label: "Phone" },
            { key: "email", label: "Email" },
            { key: "source", label: "Source" },
            { key: "category", label: "Category" },
            {
                key: "leadValue",
                label: "Lead value",
                tone: "green",
                placeholder: "Not set",
            },
        ],
    },
    {
        id: "engagement",
        title: "Marketing engagement",
        defaultOpen: true,
        copyable: false,
        fields: [
            { key: "contactScore", label: "Contact score" },
            { key: "hasRegisteredWebinar", label: "Webinar registered" },
            { key: "hasAttendedWebinar", label: "Webinar attended" },
            { key: "lastWebinarDate", label: "Last webinar" },
            { key: "hasDownloadedEbook", label: "Ebook" },
            {
                key: "hasJoinedFbGroup",
                label: "FB group",
                mutedEmpty: true,
            },
            {
                key: "hasJoinedWhatsappGroup",
                label: "WhatsApp group",
                mutedEmpty: true,
            },
        ],
    },
];
