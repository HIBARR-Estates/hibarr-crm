import type { FilterOption } from "@/contexts/FilterContext";

export type BulkUpdateControl =
    | "pills"
    | "pills-single"
    | "temperature"
    | "checklist-single";

export type BulkUpdateActionType =
    | "change_category"
    | "change_source"
    | "change_owner"
    | "change_temperature"
    | "change_lifecycle_status"
    | "change_whatsapp_group";

export interface BulkUpdateFieldDef {
    key: string;
    label: string;
    section: string;
    control: BulkUpdateControl;
    actionType: BulkUpdateActionType;
    /** Request body key for the value (except category_ids / has_joined…). */
    payloadKey: string;
    /** Allow explicitly clearing this field (null / empty). */
    clearable: boolean;
    options: FilterOption[];
}

export interface BulkUpdateOptionsInput {
    categories?: Array<{ id: number; category_name?: string; name?: string }>;
    sources?: Array<{ id: number; type: string }>;
    employees?: Array<{ id: number; name: string }>;
    temperatures?: FilterOption[];
    leadLifecycleStatuses?: Array<{
        id: number;
        label: string;
        key?: string;
    }>;
}

/**
 * Option-backed lead fields available in the Bulk update workbench.
 * Controls reuse the Lead Filter modal vocabulary (pills / temperature / checklist / segmented).
 */
export function createLeadBulkUpdateFields(
    props: BulkUpdateOptionsInput,
): BulkUpdateFieldDef[] {
    const categories = (props.categories ?? []).map((category) => ({
        value: category.id,
        label: category.category_name || category.name || String(category.id),
    }));

    const sources = (props.sources ?? []).map((source) => ({
        value: source.id,
        label: source.type,
    }));

    const employees = (props.employees ?? []).map((employee) => ({
        value: employee.id,
        label: employee.name,
    }));

    const temperatures =
        (props.temperatures?.length ?? 0) > 0
            ? props.temperatures!
            : [
                  { value: "hot", label: "Hot" },
                  { value: "warm", label: "Warm" },
                  { value: "cold", label: "Cold" },
              ];

    const statuses = (props.leadLifecycleStatuses ?? []).map((status) => ({
        value: status.id,
        label: status.label,
    }));

    return [
        {
            key: "category_ids",
            label: "Categories",
            section: "Assignment",
            control: "pills",
            actionType: "change_category",
            payloadKey: "category_ids",
            clearable: true,
            options: categories,
        },
        {
            key: "source_id",
            label: "Source",
            section: "Assignment",
            control: "pills-single",
            actionType: "change_source",
            payloadKey: "source_id",
            clearable: true,
            options: sources,
        },
        {
            key: "lead_owner",
            label: "Lead owner",
            section: "Assignment",
            control: "checklist-single",
            actionType: "change_owner",
            payloadKey: "lead_owner",
            clearable: true,
            options: employees,
        },
        {
            key: "temperature",
            label: "Temperature",
            section: "Classification",
            control: "temperature",
            actionType: "change_temperature",
            payloadKey: "temperature",
            clearable: true,
            options: temperatures,
        },
        {
            key: "lead_lifecycle_status_id",
            label: "Status",
            section: "Classification",
            control: "pills-single",
            actionType: "change_lifecycle_status",
            payloadKey: "lead_lifecycle_status_id",
            clearable: true,
            options: statuses,
        },
        {
            key: "has_joined_the_whatsapp_group",
            label: "Joined WhatsApp group",
            section: "Engagement",
            control: "pills-single",
            actionType: "change_whatsapp_group",
            payloadKey: "has_joined_the_whatsapp_group",
            clearable: false,
            options: [
                { value: "1", label: "Yes" },
                { value: "0", label: "No" },
            ],
        },
    ];
}

export function groupBulkUpdateFieldsBySection(
    fields: BulkUpdateFieldDef[],
): Array<{ name: string; fields: BulkUpdateFieldDef[] }> {
    const grouped = new Map<string, BulkUpdateFieldDef[]>();
    for (const field of fields) {
        if (!grouped.has(field.section)) grouped.set(field.section, []);
        grouped.get(field.section)!.push(field);
    }
    return Array.from(grouped.entries()).map(([name, sectionFields]) => ({
        name,
        fields: sectionFields,
    }));
}
