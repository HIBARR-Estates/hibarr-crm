import React, { useState, useEffect } from "react";
import { router, usePage } from "@inertiajs/react";
import { Drawer, Skeleton } from "antd";
import { IModalProps } from "@/Types/common";
import TaskForm from "./TaskForm";
import { useApiMutate } from "@/lib/api/client";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";

interface Task {
    id: number;
    heading: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high";
    status: string;
    board_column_id?: number;
    project?: {
        id: number;
        project_name: string;
        project_short_code?: string;
    };
    category?: {
        id: number;
        category_name: string;
    };
    users?: Array<{
        id: number;
        name: string;
        image?: string;
    }>;
    labels?: Array<{
        id: number;
        label_name: string;
        label_color: string;
    }>;
    estimate_hours?: number;
    estimate_minutes?: number;
    is_private?: boolean;
    billable?: boolean;
    without_duedate?: boolean;
}

interface TaskCategory {
    id: number;
    category_name: string;
}

interface TaskLabel {
    id: number;
    label_name: string;
    label_color: string;
}

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface User {
    id: number;
    name: string;
    image?: string;
    designation_name?: string;
}

interface Project {
    id: number;
    project_name: string;
    project_short_code: string;
}

interface Deal {
    id: number;
    name: string;
}

interface Lead {
    id: number;
    client_name: string;
    company_name?: string;
}

interface Property {
    id: number;
    name: string;
}

interface CreateTaskFormData {
    heading: string;
    description?: string;
    start_date?: string;
    due_date?: string;
    priority: "low" | "medium" | "high";
    project_id?: number;
    user_ids?: number[];
    category_id?: number;
    task_labels?: number[];
    estimate_hours?: number;
    estimate_minutes?: number;
    board_column_id?: number;
    is_private?: boolean;
    billable?: boolean;
    without_duedate?: boolean;
    deal_id?: number;
    lead_id?: number;
    property_id?: number;
}

interface SaveTaskModalProps extends Omit<IModalProps, "onClose"> {
    task?: { id: number } | Task;
    isDuplicate?: boolean;
    setTask?: (task: Task | undefined) => void;
    onClose: () => void;
    categories: TaskCategory[];
    labels: TaskLabel[];
    columns: TaskboardColumn[];
    users: User[];
    projects: Project[];
    deals?: Deal[];
    leads?: Lead[];
    properties?: Property[];
    relatedEntity?: {
        type: "deal" | "lead" | "property";
        id?: number;
    };
    td?: (key: string) => string;
    onSuccess?: () => void;
    reloadKeys?: string[];
}

const SaveTaskModal: React.FC<SaveTaskModalProps> = ({
    task,
    isDuplicate = false,
    onClose,
    open,
    setTask,
    categories,
    labels,
    columns,
    users,
    projects,
    deals = [],
    leads = [],
    properties = [],
    relatedEntity,
    td = (key) => key,
    onSuccess,
    reloadKeys,
}) => {
    const { props } = usePage();

    const [errors, setErrors] = useState<string[]>([]);
    const [formData, setFormData] = useState<CreateTaskFormData | null>(null);

    // Determine the operation type
    const isEditing = !!task && !isDuplicate;
    const isCreating = !task;
    const isDuplicating = !!task && isDuplicate;

    // Fetch full task details if editing
    const { data: fetchedTaskData, isLoading: isFetchingTask } = useApiQuery<{
        task: Task;
    }>({
        path: isEditing && task?.id ? route("tasks.data", task.id) : "",
        options: {
            enabled: isEditing && !!task?.id && open,
        },
    });

    const activeTask =
        isEditing && fetchedTaskData?.task
            ? fetchedTaskData.task
            : (task as Task | undefined);

    const getTitle = () => {
        if (isEditing) return "Edit Task";
        if (isDuplicating) return "Duplicate Task";
        return "Create Task";
    };

    const submitText = isEditing ? "Update Task" : "Create Task";

    // Initialize form data
    const getInitialData = (): CreateTaskFormData => ({
        heading: isDuplicating
            ? `${activeTask?.heading} (Copy)`
            : activeTask?.heading || "",
        description: activeTask?.description || "",
        start_date: activeTask?.start_date || "",
        due_date: isDuplicating ? "" : activeTask?.due_date || "",
        priority: activeTask?.priority || "medium",
        project_id: activeTask?.project?.id,
        user_ids: activeTask?.users?.map((u) => u.id) || [],
        category_id: activeTask?.category?.id,
        task_labels: activeTask?.labels?.map((l) => l.id) || [],
        estimate_hours: activeTask?.estimate_hours || 0,
        estimate_minutes: activeTask?.estimate_minutes || 0,
        board_column_id:
            activeTask?.board_column_id ||
            columns.find((col) => col.slug === "to_do")?.id,
        is_private: activeTask?.is_private || false,
        billable: activeTask?.billable || false,
        without_duedate: activeTask?.without_duedate || false,
        deal_id: (activeTask as any)?.deals?.[0]?.id,
        lead_id: (activeTask as any)?.leads?.[0]?.id,
        property_id: (activeTask as any)?.properties?.[0]?.id,
    });

    // Setup API mutation
    const { mutate: createTask, status: createStatus } = useApiMutate<
        CreateTaskFormData,
        Task,
        ApiResponse<Task>
    >(route("tasks.store"), "POST");

    const { mutate: updateTask, status: updateStatus } = useApiMutate<
        CreateTaskFormData,
        Task,
        ApiResponse<Task>
    >(isEditing ? route("tasks.update", (task as any)?.id) : "", "PUT");

    // Update form data when task changes
    useEffect(() => {
        if (open && !isFetchingTask) {
            const initialData = getInitialData();
            setFormData(initialData);
        }
    }, [activeTask, isDuplicate, open, isFetchingTask]);

    const handleSubmit = (values: any) => {
        // Clear previous errors
        setErrors([]);

        const company = props.company;

        // Helper to convert PHP date format to Dayjs format
        const mapPhpToDayjsFormat = (format: string) => {
            if (!format) return "YYYY-MM-DD HH:mm";

            const replacements: Record<string, string> = {
                d: "DD",
                D: "ddd",
                j: "D",
                l: "dddd",
                N: "E",
                S: "Do",
                w: "d",
                z: "DDD",
                W: "W",
                F: "MMMM",
                m: "MM",
                M: "MMM",
                n: "M",
                t: "Days in month",
                L: "Leap year",
                o: "GGGG",
                Y: "YYYY",
                y: "YY",
                a: "a",
                A: "A",
                B: "Swatch",
                g: "h",
                G: "H",
                h: "hh",
                H: "HH",
                i: "mm",
                s: "ss",
                u: "SSS",
                e: "zz",
            };

            return format
                .split("")
                .map((char) => replacements[char] || char)
                .join("");
        };

        const phpDateFormat =
            (company?.date_format || "d-m-Y") +
            " " +
            (company?.time_format || "H:i");
        const dateFormat = mapPhpToDayjsFormat(phpDateFormat);

        const submitData = {
            ...values,
            start_date: values.start_date?.format
                ? values.start_date.format(dateFormat)
                : values.start_date,
            due_date: values.due_date?.format
                ? values.due_date.format(dateFormat)
                : values.due_date,
            estimate_hours: values.estimate_hours || 0,
            estimate_minutes: values.estimate_minutes || 0,
            taskable_type: values?.taskable_type ?? relatedEntity?.type,
            taskable_id: values?.taskable_id ?? relatedEntity?.id,
        };

        const mutation = isEditing ? updateTask : createTask;

        mutation(submitData, {
            onSuccess: () => {
                setErrors([]);
                handleCancel();
                onSuccess?.();
                router.reload({
                    only: reloadKeys ?? [
                        "tableTasks",
                        "kanbanTasks",
                        "stats",
                        "tasks",
                    ],
                });
            },
            onError: (errorResponse) => {
                const responseErrors =
                    errorFormatter(errorResponse)?.errors || [];
                setErrors((prev) => [
                    ...prev,
                    ...Object.values(responseErrors).flat(),
                ]);
            },
        });
    };

    const handleCancel = () => {
        setFormData(null);
        setErrors([]);
        onClose();
    };

    const handleErrorsClear = () => {
        setErrors([]);
    };

    const isLoading =
        getLoadingStatus({ status: createStatus }) ||
        getLoadingStatus({ status: updateStatus });

    return (
        <Drawer
            title={getTitle()}
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnHidden
        >
            {isFetchingTask ? (
                <Skeleton active paragraph={{ rows: 10 }} />
            ) : (
                <>
                    {/* show errors */}
                    {errors.length > 0 && (
                        <div className="mb-4">
                            {errors.map((error, index) => (
                                <div key={index} className="text-red-600">
                                    {error}
                                </div>
                            ))}
                        </div>
                    )}
                    <TaskForm
                        data={formData || undefined}
                        visible={open}
                        onCancel={handleCancel}
                        onSubmit={handleSubmit}
                        submitText={td(submitText)}
                        cancelText={td("Cancel")}
                        errors={errors}
                        setErrors={(newErrors) => {
                            if (Array.isArray(newErrors)) {
                                setErrors(newErrors);
                            }
                        }}
                        onErrorsClear={handleErrorsClear}
                        loading={isLoading}
                        categories={categories}
                        labels={labels}
                        columns={columns}
                        users={users}
                        projects={projects}
                        deals={deals}
                        leads={leads}
                        properties={properties}
                        relatedEntity={relatedEntity}
                        td={td}
                    />
                </>
            )}
        </Drawer>
    );
};

export default SaveTaskModal;
