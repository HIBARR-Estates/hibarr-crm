import React, { useState, useEffect } from "react";
import { router, usePage } from "@inertiajs/react";
import { Modal, Skeleton } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import "./save-task-modal.css";
import { IModalProps } from "@/Types/common";
import TaskForm from "./TaskForm";
import { useApiMutate } from "@/lib/api/client";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import TaskEntityLink from "@/Features/Tasks/Components/TaskEntityLink";

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
    title: string;
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
    /** Called after a successful create/update with the API task payload when available. */
    onSuccess?: (task?: Task) => void;
    /**
     * Inertia partial-reload keys after success. Pass `false` to skip reload
     * (use when the parent merges the returned task into local state).
     */
    reloadKeys?: string[] | false;
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

    // True when the caller didn't supply any picker options at all (e.g. the
    // Dashboard), meaning TaskForm's "Related to" section never renders and
    // the user has no way to see/change the link through this form.
    const noEntityPickerRendered =
        deals.length === 0 && leads.length === 0 && properties.length === 0;

    // Resolve which deal/lead/property this task is linked to, so we can (a)
    // show it to the user regardless of which page opened this modal, and
    // (b) preserve the link on submit even when the caller (e.g. the
    // Dashboard) doesn't pass a `deals`/`leads` picker list, in which case
    // the "Related to" fields in TaskForm aren't rendered at all.
    const linkedEntity = React.useMemo(() => {
        // Prefer the richer task data (has real names) whenever it's available —
        // it's always accurate for the task actually being edited/duplicated.
        const anyTask = activeTask as any;
        if (anyTask?.deals?.[0]) {
            return { type: "deal" as const, id: anyTask.deals[0].id, name: anyTask.deals[0].name };
        }
        if (anyTask?.deal) {
            return { type: "deal" as const, id: anyTask.deal.id, name: anyTask.deal.name };
        }
        if (anyTask?.leads?.[0]) {
            return {
                type: "lead" as const,
                id: anyTask.leads[0].id,
                name: anyTask.leads[0].client_name,
            };
        }
        if (anyTask?.lead) {
            return { type: "lead" as const, id: anyTask.lead.id, name: anyTask.lead.client_name };
        }
        if (anyTask?.properties?.[0]) {
            return {
                type: "property" as const,
                id: anyTask.properties[0].id,
                name: anyTask.properties[0].title,
            };
        }

        // Fall back to the caller-supplied relatedEntity (e.g. a brand new task
        // being created from a Deal/Lead's own task tab, before it has any
        // fetched task data of its own).
        if (relatedEntity?.id) {
            const lookupName =
                relatedEntity.type === "deal"
                    ? deals.find((d) => d.id === relatedEntity.id)?.name
                    : relatedEntity.type === "lead"
                      ? leads.find((l) => l.id === relatedEntity.id)?.client_name
                      : properties.find((p) => p.id === relatedEntity.id)?.title;
            return { ...relatedEntity, name: lookupName };
        }

        return undefined;
    }, [relatedEntity, activeTask, deals, leads, properties]);

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
            // Only fall back to the derived link when no "Related to" picker was
            // ever rendered for the user (e.g. opened from the Dashboard, which
            // doesn't pass deals/leads/properties lists) — otherwise trust the
            // form values as-is so clearing/reassigning a picker field on pages
            // that do show it (e.g. the Tasks list) keeps working.
            taskable_type:
                values?.taskable_type ??
                (noEntityPickerRendered ? linkedEntity?.type : undefined),
            taskable_id:
                values?.taskable_id ??
                (noEntityPickerRendered ? linkedEntity?.id : undefined),
        };

        const mutation = isEditing ? updateTask : createTask;

        mutation(submitData, {
            onSuccess: (response) => {
                setErrors([]);
                handleCancel();
                const savedTask =
                    response && "data" in response
                        ? (response.data as Task | undefined)
                        : undefined;
                onSuccess?.(savedTask);
                if (reloadKeys !== false) {
                    router.reload({
                        only: reloadKeys ?? [
                            "tableTasks",
                            "kanbanTasks",
                            "stats",
                            "tasks",
                            "overviewMetrics",
                            "taskBoardColumns",
                        ],
                    });
                }
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

    const FORM_ID = "save-task-modal-form";

    return (
        <Modal
            className="save-task-modal"
            title={null}
            open={open}
            onCancel={handleCancel}
            footer={null}
            width={900}
            centered
            destroyOnHidden
            maskClosable={false}
            closable
        >
            {/* Header */}
            <div className="px-6 pt-6 pb-5 pr-14 border-b border-gray-100 shrink-0">
                <h2 className="text-xl font-semibold text-gray-900 leading-tight">
                    {getTitle()}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    {isEditing
                        ? "Update the task details below."
                        : "Fill in the details below to create a new task."}
                </p>
                {linkedEntity?.id && linkedEntity.type !== "property" && (
                    <div className="mt-2">
                        {linkedEntity.name ? (
                            <TaskEntityLink
                                type={linkedEntity.type as "deal" | "lead"}
                                id={linkedEntity.id}
                                name={linkedEntity.name}
                                className="!text-sm"
                                stopPropagation={false}
                            />
                        ) : (
                            <span className="text-xs text-gray-400">
                                Linked to a {linkedEntity.type}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 pb-2">
                {isFetchingTask ? (
                    <div className="py-8">
                        <Skeleton active paragraph={{ rows: 10 }} />
                    </div>
                ) : (
                    <>
                        {errors.length > 0 && (
                            <div className="mt-4 mb-0">
                                {errors.map((error, index) => (
                                    <div key={index} className="text-red-600 text-sm">
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
                            formId={FORM_ID}
                            hideFooter={true}
                        />
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-between">
                <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                >
                    {td("Cancel")}
                </button>
                <div className="flex items-center gap-3">
                    {errors.length > 0 && (
                        <p className="text-[11px] text-red-500 italic">
                            Please fix the errors above
                        </p>
                    )}
                    <button
                        form={FORM_ID}
                        type="submit"
                        disabled={isLoading || isFetchingTask}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            !isLoading && !isFetchingTask
                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 active:scale-[0.98]"
                                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                        }`}
                    >
                        <SaveOutlined />
                        {isLoading ? "Saving…" : td(submitText)}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default SaveTaskModal;
