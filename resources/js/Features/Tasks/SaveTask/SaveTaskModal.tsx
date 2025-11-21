import React, { useState, useEffect } from "react";
import { router, useForm, usePage } from "@inertiajs/react";
import { Drawer, message, Form } from "antd";
import { IModalProps } from "@/Types/common";
import TaskForm from "./TaskForm";

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
}) => {
    const [errors, setErrors] = useState<Record<string, string>>({});

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
    const initialData: CreateTaskFormData = {
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
    };

    // Use Inertia's useForm hook for better CSRF and error handling
    const {
        data,
        setData,
        submit,
        processing,
        errors: formErrors,
        reset,
    } = useForm(initialData);
    const [pushing, setPushing] = useState(false);

    // Update form data when task changes
    useEffect(() => {
        if (task) {
            const updatedData: CreateTaskFormData = {
                heading: isDuplicating
                    ? `${task.heading} (Copy)`
                    : task.heading,
                description: task.description || "",
                start_date: task.start_date || "",
                due_date: isDuplicating ? "" : task.due_date || "",
                priority: task.priority || "medium",
                project_id: task.project?.id,
                user_ids: task.users?.map((u) => u.id) || [],
                category_id: task.category?.id,
                task_labels: task.labels?.map((l) => l.id) || [],
                estimate_hours: task.estimate_hours || 0,
                estimate_minutes: task.estimate_minutes || 0,
                board_column_id:
                    task.board_column_id ||
                    columns.find((col) => col.slug === "incomplete")?.id,
                is_private: task.is_private || false,
                billable: task.billable || false,
                without_duedate: task.without_duedate || false,
            };

            setData(updatedData);
        }
    }, [task, isDuplicate]);

    useEffect(() => {
        if (pushing) {
            if (isEditing) {
                submit("put", route("tasks.update", task!.id), {
                    onSuccess: () => {
                        setPushing(false);
                        message.success("Task updated successfully");
                        onClose();
                        router.reload();
                    },
                    onError: (errors) => {
                        setPushing(false);
                        setErrors(errors as Record<string, string>);
                        message.error("Please check the form for errors");
                    },
                });
            } else {
                submit("post", route("tasks.store"), {
                    onSuccess: () => {
                        setPushing(false);
                        message.success("Task created successfully");
                        reset();
                        onClose();
                        router.reload();
                    },
                    onError: (errors) => {
                        setPushing(false);
                        setErrors(errors as Record<string, string>);
                        message.error("Please check the form for errors");
                    },
                });
            }
        }
    }, [pushing]);

    const handleSubmit = (formData: any) => {
        // Clear previous errors
        setErrors({});

        // dates should be d-m-Y

        // Transform the values to match the API expectations
        const submitData = {
            ...formData,
            start_date: formData.start_date?.format
                ? formData.start_date.format("DD-MM-YYYY")
                : formData.start_date,
            due_date: formData.due_date?.format
                ? formData.due_date.format("DD-MM-YYYY")
                : formData.due_date,
        };

        // Update the form data
        setData(submitData);
        setPushing(true);
    };

    const handleCancel = () => {
        reset();
        setErrors({});
        onClose();
    };

    const handleErrorsClear = () => {
        setErrors({});
    };

    // Combine form errors with manual errors
    const allErrors = [
        ...Object.values(errors).flat().map(String),
        ...Object.values(formErrors).flat().map(String),
    ];

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
            {allErrors.length > 0 && (
                <div className="mb-4">
                    {allErrors.map((error, index) => (
                        <div key={index} className="text-red-600">
                            {error}
                        </div>
                    ))}
                </div>
            )}
            <TaskForm
                data={data}
                visible={open}
                onCancel={handleCancel}
                onSubmit={handleSubmit}
                submitText={submitText}
                cancelText="Cancel"
                errors={allErrors}
                setErrors={(errors) => {
                    // errors.forEach((error, field) =>
                    //     setErrors((prev) => ({ ...prev, [field]: error }))
                    // )
                }}
                onErrorsClear={handleErrorsClear}
                loading={processing || pushing}
                categories={categories}
                labels={labels}
                columns={columns}
                users={users}
                projects={projects}
            />
        </Drawer>
    );
};

export default SaveTaskModal;
