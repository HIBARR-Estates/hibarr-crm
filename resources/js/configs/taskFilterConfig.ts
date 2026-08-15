import { FilterConfig } from "@/contexts/FilterContext";
import { TasksIndexProps } from "@/Pages/Tasks/Index";

const createTaskFilterConfig = (
    props: Partial<TasksIndexProps>
): FilterConfig => {
    const fields: FilterConfig["fields"] = [
        {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search tasks...",
            span: 24,
        },
        {
            key: "status",
            label: "Status",
            type: "select",
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
            type: "select",
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
            label: "Assignee",
            type: "select",
            options:
                props.users?.map((user) => ({
                    label: user.name,
                    value: user.id,
                })) || [],
            placeholder: "Filter by assignee",
        },
        {
            key: "project_id",
            label: "Project",
            type: "select",
            options:
                props.projects?.map((project) => ({
                    label: project.project_name,
                    value: project.id,
                })) || [],
            placeholder: "Filter by project",
        },
        {
            key: "category_id",
            label: "Category",
            type: "select",
            options:
                props.categories?.map((cat) => ({
                    label: cat.category_name,
                    value: cat.id,
                })) || [],
            placeholder: "Filter by category",
        },
        {
            key: "labels",
            label: "Labels",
            type: "multiselect",
            options:
                props.labels?.map((label) => ({
                    label: label.label_name,
                    value: label.id,
                })) || [],
            placeholder: "Filter by labels",
        },
        {
            key: "due_date_range",
            label: "Due Date",
            type: "daterange",
        },
        {
            key: "created_date_range",
            label: "Created Date",
            type: "daterange",
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
