/**
 * Field picker config for deal bulk export.
 * Keys must stay in sync with App\Support\DealExportFields.
 */
import type { BulkExportFieldDef } from "@/Features/BulkActions/exportFields";

export const DEAL_EXPORT_FIELDS: BulkExportFieldDef[] = [
    // Meta
    { key: "id", label: "ID", group: "Meta" },
    { key: "created_at", label: "Created at", group: "Meta", defaultSelected: true },
    { key: "updated_at", label: "Updated at", group: "Meta" },

    // Deal
    { key: "name", label: "Deal name", group: "Deal", defaultSelected: true },
    { key: "value", label: "Value", group: "Deal", defaultSelected: true },
    { key: "currency", label: "Currency", group: "Deal", defaultSelected: true },
    { key: "outcome_status", label: "Outcome", group: "Deal", defaultSelected: true },
    { key: "is_locked", label: "Locked", group: "Deal" },
    { key: "close_date", label: "Close date", group: "Deal", defaultSelected: true },
    { key: "next_follow_up", label: "Next follow-up", group: "Deal" },

    // Pipeline
    { key: "pipeline", label: "Pipeline", group: "Pipeline", defaultSelected: true },
    { key: "stage", label: "Stage", group: "Pipeline", defaultSelected: true },
    { key: "category", label: "Category", group: "Pipeline" },

    // Assignment
    { key: "agent", label: "Agent", group: "Assignment", defaultSelected: true },
    { key: "added_by", label: "Added by", group: "Assignment" },

    // Contact
    { key: "contact_name", label: "Contact name", group: "Contact", defaultSelected: true },
    { key: "contact_email", label: "Contact email", group: "Contact", defaultSelected: true },
    { key: "contact_mobile", label: "Contact mobile", group: "Contact" },
    { key: "contact_company", label: "Contact company", group: "Contact" },
    { key: "contact_source", label: "Lead source", group: "Contact" },

    // Products
    { key: "packages", label: "Packages", group: "Products", defaultSelected: true },
    { key: "properties", label: "Properties", group: "Products" },
];
