import {
    asArray,
    type BulkUpdateFieldDef,
    type BulkUpdateValue,
} from "@/Features/BulkActions/bulkUpdateFields";

export type { BulkUpdateFieldDef };
export { groupBulkUpdateFieldsBySection } from "@/Features/BulkActions/bulkUpdateFields";

export interface TaskBulkUpdateOptionsInput {
    columns?: Array<{ id: number; column_name: string; slug: string }>;
    categories?: Array<{ id: number; category_name: string }>;
    users?: Array<{ id: number; name: string }>;
}

const numberOrNull = (value: BulkUpdateValue) =>
    value == null || value === "" ? null : Number(value);

const PRIORITY_OPTIONS = [
    { value: "urgent", label: "Urgent" },
    { value: "highest", label: "Highest" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
    { value: "lowest", label: "Lowest" },
];

/**
 * Option-backed task fields available in the Bulk update workbench —
 * mirrors createLeadBulkUpdateFields (Leads/BulkActions/bulkUpdateConfig.ts)
 * so Tasks gets the same "set several fields on N selected rows" modal.
 */
export function createTaskBulkUpdateFields(
    props: TaskBulkUpdateOptionsInput,
): BulkUpdateFieldDef[] {
    const statuses = (props.columns ?? []).map((column) => ({
        value: column.id,
        label: column.column_name,
    }));

    const categories = (props.categories ?? []).map((category) => ({
        value: category.id,
        label: category.category_name,
    }));

    const users = (props.users ?? []).map((user) => ({
        value: user.id,
        label: user.name,
    }));

    return [
        {
            key: "status",
            label: "Status",
            section: "General",
            control: "pills-single",
            clearable: false,
            options: statuses,
            toPayload: (value) => ({ status: numberOrNull(value) }),
        },
        {
            key: "priority",
            label: "Priority",
            section: "General",
            control: "pills-single",
            clearable: false,
            options: PRIORITY_OPTIONS,
            toPayload: (value) => ({
                priority: value == null || value === "" ? null : String(value),
            }),
        },
        {
            key: "task_category_id",
            label: "Category",
            section: "Classification",
            control: "pills-single",
            clearable: true,
            options: categories,
            toPayload: (value) => ({ task_category_id: numberOrNull(value) }),
        },
        {
            key: "assigned_to",
            label: "Assignees",
            section: "Assignment",
            control: "checklist",
            clearable: true,
            hint: "Replaces existing assignees",
            options: users,
            toPayload: (value) => ({
                user_id: asArray(value).map(Number).filter(Boolean),
            }),
        },
    ];
}
