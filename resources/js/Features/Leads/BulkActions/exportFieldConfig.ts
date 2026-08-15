/**
 * Field picker config for lead bulk export.
 * Keys must stay in sync with App\Support\LeadExportFields.
 */
import type { BulkExportFieldDef } from "@/Features/BulkActions/exportFields";

export const LEAD_EXPORT_FIELDS: BulkExportFieldDef[] = [
    // Meta
    { key: "id", label: "ID", group: "Meta" },
    { key: "created_at", label: "Created at", group: "Meta", defaultSelected: true },
    { key: "updated_at", label: "Updated at", group: "Meta" },

    // Contact
    { key: "client_name", label: "Lead name", group: "Contact", defaultSelected: true },
    { key: "salutation", label: "Salutation", group: "Contact" },
    { key: "client_email", label: "Email", group: "Contact", defaultSelected: true },
    { key: "mobile", label: "Mobile", group: "Contact", defaultSelected: true },
    { key: "office", label: "Office phone", group: "Contact" },
    { key: "client_whatsapp", label: "WhatsApp", group: "Contact" },
    { key: "client_telegram", label: "Telegram", group: "Contact" },
    { key: "client_instagram", label: "Instagram", group: "Contact" },
    { key: "company_name", label: "Company", group: "Contact" },

    // Profile
    { key: "gender", label: "Gender", group: "Profile" },
    { key: "date_of_birth", label: "Date of birth", group: "Profile" },
    { key: "nationality", label: "Nationality", group: "Profile" },
    { key: "occupation", label: "Occupation", group: "Profile" },
    { key: "languages", label: "Languages", group: "Profile" },
    { key: "temperature", label: "Temperature", group: "Profile", defaultSelected: true },
    { key: "preferred_contact_time", label: "Preferred contact time", group: "Profile" },
    { key: "value", label: "Lead value", group: "Profile" },
    { key: "currency", label: "Currency", group: "Profile" },

    // Address
    { key: "address", label: "Street address", group: "Address" },
    { key: "postal_code", label: "Postal code", group: "Address" },
    { key: "city", label: "City", group: "Address" },
    { key: "state", label: "State", group: "Address" },
    { key: "country", label: "Country", group: "Address" },

    // Assignment
    { key: "source", label: "Source", group: "Assignment", defaultSelected: true },
    { key: "categories", label: "Categories", group: "Assignment", defaultSelected: true },
    { key: "lead_owner", label: "Lead owner", group: "Assignment", defaultSelected: true },
    { key: "added_by", label: "Added by", group: "Assignment" },
    { key: "lifecycle_status", label: "Lifecycle status", group: "Assignment", defaultSelected: true },

    // Marketing
    { key: "utm_source", label: "UTM source", group: "Marketing" },
    { key: "utm_medium", label: "UTM medium", group: "Marketing" },
    { key: "utm_campaign", label: "UTM campaign", group: "Marketing" },
    { key: "utm_content", label: "UTM content", group: "Marketing" },
    { key: "utm_term", label: "UTM term", group: "Marketing" },
    { key: "utm_audience", label: "UTM audience", group: "Marketing" },
    { key: "contact_score", label: "Contact score", group: "Marketing" },
    {
        key: "has_registered_for_the_webinar",
        label: "Webinar registered",
        group: "Marketing",
    },
    {
        key: "has_attended_the_webinar",
        label: "Webinar attended",
        group: "Marketing",
    },
    { key: "last_webinar_date", label: "Last webinar", group: "Marketing" },
    {
        key: "has_downloaded_the_ebook",
        label: "Ebook downloaded",
        group: "Marketing",
    },
    {
        key: "has_joined_the_facebook_group",
        label: "FB group",
        group: "Marketing",
    },
    {
        key: "has_joined_the_whatsapp_group",
        label: "WhatsApp group",
        group: "Marketing",
    },
];
