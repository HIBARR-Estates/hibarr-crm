import React, { useState, useEffect } from "react";
import { router } from "@inertiajs/react";
import { Drawer } from "antd";
import { IModalProps } from "@/Types/common";
import TaskForm from "./TaskForm";
import { useApiMutate } from "@/lib/api/client";
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
    task?: Task;
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
}) => {
    const [errors, setErrors] = useState<string[]>([]);
    const [formData, setFormData] = useState<CreateTaskFormData | null>(null);

    // Determine the operation type
    const isEditing = !!task && !isDuplicate;
    const isCreating = !task;
    const isDuplicating = !!task && isDuplicate;

    const getTitle = () => {
        if (isEditing) return "Edit Task";
        if (isDuplicating) return "Duplicate Task";
        return "Create Task";
    };

    const submitText = isEditing ? "Update Task" : "Create Task";

    // Initialize form data
    const getInitialData = (): CreateTaskFormData => ({
        heading: isDuplicating
            ? `${task?.heading} (Copy)`
            : task?.heading || "",
        description: task?.description || "",
        start_date: task?.start_date || "",
        due_date: isDuplicating ? "" : task?.due_date || "",
        priority: task?.priority || "medium",
        project_id: task?.project?.id,
        user_ids: task?.users?.map((u) => u.id) || [],
        category_id: task?.category?.id,
        task_labels: task?.labels?.map((l) => l.id) || [],
        estimate_hours: task?.estimate_hours || 0,
        estimate_minutes: task?.estimate_minutes || 0,
        board_column_id:
            task?.board_column_id ||
            columns.find((col) => col.slug === "incomplete")?.id,
        is_private: task?.is_private || false,
        billable: task?.billable || false,
        without_duedate: task?.without_duedate || false,
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
    >(isEditing ? route("tasks.update", task!.id) : "", "PUT");

    // Update form data when task changes
    useEffect(() => {
        if (open) {
            const initialData = getInitialData();
            setFormData(initialData);
        }
    }, [task, isDuplicate, open]);

    const handleSubmit = (values: any) => {
        // Clear previous errors
        setErrors([]);

        // dates should be d-m-Y
        const submitData = {
            ...values,
            start_date: values.start_date?.format
                ? values.start_date.format("DD-MM-YYYY")
                : values.start_date,
            due_date: values.due_date?.format
                ? values.due_date.format("DD-MM-YYYY")
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
                router.reload({
                    only: ["tasks"], // Adjust based on what needs to be refreshed
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
                submitText={submitText}
                cancelText="Cancel"
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
            />
        </Drawer>
    );
};

export default SaveTaskModal;
