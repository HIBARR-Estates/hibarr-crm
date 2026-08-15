import type { FilterOption } from "@/contexts/FilterContext";
import {
    asArray,
    type BulkUpdateFieldDef,
    type BulkUpdateValue,
} from "@/Features/BulkActions/bulkUpdateFields";

export type { BulkUpdateFieldDef };
export { groupBulkUpdateFieldsBySection } from "@/Features/BulkActions/bulkUpdateFields";

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

const numberOrNull = (value: BulkUpdateValue) =>
    value == null || value === "" ? null : Number(value);

/**
 * Option-backed lead fields available in the Bulk update workbench.
 * Controls reuse the filter modal vocabulary (pills / temperature / checklist).
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
            clearable: true,
            hint: "Replaces existing categories",
            options: categories,
            toPayload: (value) => ({
                category_ids: asArray(value).map(Number).filter(Boolean),
            }),
        },
        {
            key: "source_id",
            label: "Source",
            section: "Assignment",
            control: "pills-single",
            clearable: true,
            options: sources,
            toPayload: (value) => ({ source_id: numberOrNull(value) }),
        },
        {
            key: "lead_owner",
            label: "Lead owner",
            section: "Assignment",
            control: "checklist-single",
            clearable: true,
            options: employees,
            toPayload: (value) => ({ lead_owner: numberOrNull(value) }),
        },
        {
            key: "temperature",
            label: "Temperature",
            section: "Classification",
            control: "temperature",
            clearable: true,
            options: temperatures,
            toPayload: (value) => ({
                temperature:
                    value == null || value === "" ? null : String(value),
            }),
        },
        {
            key: "lead_lifecycle_status_id",
            label: "Status",
            section: "Classification",
            control: "pills-single",
            clearable: true,
            options: statuses,
            toPayload: (value) => ({
                lead_lifecycle_status_id: numberOrNull(value),
            }),
        },
        {
            key: "has_joined_the_whatsapp_group",
            label: "Joined WhatsApp group",
            section: "Engagement",
            control: "pills-single",
            clearable: false,
            options: [
                { value: "1", label: "Yes" },
                { value: "0", label: "No" },
            ],
            toPayload: (value) => ({
                has_joined_the_whatsapp_group:
                    value === true || value === 1 || value === "1",
            }),
        },
    ];
}
