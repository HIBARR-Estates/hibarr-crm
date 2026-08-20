import { FilterConfig } from "@/contexts/FilterContext";
import { TasksIndexProps } from "@/Pages/Tasks/Index";

/**
 * Filter fields for the tasks index.
 *
 * `control` / `section` / `sentence` are read by the shared
 * `EntityFilterModal` (the same workbench Leads and Deals use); the legacy
 * `UniversalFilterDrawer` ignores them and still renders by `type`, so both
 * the redesigned and legacy screens stay on this one config.
 */
const createTaskFilterConfig = (
    props: Partial<TasksIndexProps>,
): FilterConfig => {
    const fields: FilterConfig["fields"] = [
        {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search tasks...",
            span: 24,
            section: "General",
        },
        {
            key: "status",
            label: "Status",
            type: "multiselect",
            control: "pills",
            section: "General",
            sentence: "status",
            options:
                props.columns?.map((col) => ({
                    label: col.column_name,
                    value: col.slug,
                })) || [],
            placeholder: "Filter by status",
        },
        {
            key: "priority",
            label: "Priority",
            type: "multiselect",
            control: "pills",
            section: "General",
            sentence: "priority",
            options: [
                { label: "Urgent", value: "urgent" },
                { label: "Highest", value: "highest" },
                { label: "High", value: "high" },
                { label: "Medium", value: "medium" },
                { label: "Low", value: "low" },
            ],
            placeholder: "Filter by priority",
        },
        {
            key: "assigned_to",
            label: "Assigned to",
            type: "multiselect",
            control: "checklist",
            section: "Assignment",
            sentence: "assignee",
            options:
                props.users?.map((user) => ({
                    label: user.name,
                    value: user.id,
                })) || [],
            placeholder: "Filter by assignee",
        },
        {
            key: "assigned_by",
            label: "Assigned by",
            type: "multiselect",
            control: "checklist",
            section: "Assignment",
            sentence: "assigner",
            options:
                props.users?.map((user) => ({
                    label: user.name,
                    value: user.id,
                })) || [],
            placeholder: "Filter by assigner",
        },
        {
            key: "category_id",
            label: "Task category",
            type: "multiselect",
            control: "pills",
            section: "Category",
            sentence: "category",
            options:
                props.categories?.map((cat) => ({
                    label: cat.category_name,
                    value: cat.id,
                })) || [],
            placeholder: "Filter by category",
        },
        {
            key: "project_id",
            label: "Project",
            type: "select",
            section: "Category",
            sentence: "project",
            options:
                props.projects?.map((project) => ({
                    label: project.project_name,
                    value: project.id,
                })) || [],
            placeholder: "Filter by project",
        },
        {
            key: "labels",
            label: "Labels",
            type: "multiselect",
            control: "tokens",
            section: "Category",
            sentence: "label",
            options:
                props.labels?.map((label) => ({
                    label: label.label_name,
                    value: label.id,
                })) || [],
            placeholder: "Filter by labels",
        },
        {
            key: "due_date_range",
            label: "Due date",
            type: "daterange",
            control: "datePresets",
            section: "Dates",
            sentence: "due date",
            rangeKeys: ["due_start_date", "due_end_date"],
        },
        {
            key: "created_date_range",
            label: "Created date",
            type: "daterange",
            control: "datePresets",
            section: "Dates",
            sentence: "created date",
            rangeKeys: ["created_start_date", "created_end_date"],
        },
    ];

    return {
        routeName: "tasks.index",
        title: "Task Filters",
        fields,
        excludeFields: props.excludeFields,
        defaultValues: {},
    };
};

export default createTaskFilterConfig;
