import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useDealTaskCreate from "../../hooks/useDealTaskCreate";
import { DEFAULT_DUE_TIME } from "../../hooks/taskDateUtils";
import DealButton from "../primitives/DealButton";
import { DealModal, DealModalField } from "../primitives/DealModal";
import DealAssigneeField from "./DealAssigneeField";

interface DealAddTaskModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
}

type TaskPriority = "low" | "medium" | "high";

interface TaskFormState {
    title: string;
    dueDate: string;
    dueTime: string;
    priority: TaskPriority;
    description: string;
    assignees: number[];
}

function buildInitialForm(currentUserId?: number): TaskFormState {
    return {
        title: "",
        dueDate: "",
        dueTime: DEFAULT_DUE_TIME,
        priority: "medium",
        description: "",
        assignees: currentUserId ? [currentUserId] : [],
    };
}

export default function DealAddTaskModal({
    open,
    onClose,
    dealId,
}: DealAddTaskModalProps) {
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const [form, setForm] = useState<TaskFormState>(() =>
        buildInitialForm(currentUserId),
    );
    const { createTask, isCreating, errors, clearErrors } =
        useDealTaskCreate(dealId);

    useEffect(() => {
        if (!open) {
            setForm(buildInitialForm(currentUserId));
            clearErrors();
        }
    }, [clearErrors, open, currentUserId]);

    const handleClose = () => {
        if (isCreating) return;
        onClose();
    };

    const handleSubmit = () => {
        createTask(
            {
                title: form.title,
                dueDate: form.dueDate,
                dueTime: form.dueTime,
                priority: form.priority,
                description: form.description,
                assignees: form.assignees,
            },
            handleClose,
        );
    };

    return (
        <DealModal
            open={open}
            title={td("Add task")}
            onClose={handleClose}
            footer={
                <>
                    <DealButton
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isCreating}
                    >
                        {td("Cancel")}
                    </DealButton>
                    <DealButton
                        variant="primary"
                        onClick={handleSubmit}
                        loading={isCreating}
                        disabled={isCreating}
                    >
                        {td("Create task")}
                    </DealButton>
                </>
            }
        >
            {errors.length > 0 && (
                <div className="mb-3 space-y-1">
                    {errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600">
                            {error}
                        </p>
                    ))}
                </div>
            )}

            <DealModalField label={td("Task title")}>
                <input
                    value={form.title}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            title: event.target.value,
                        }))
                    }
                    placeholder={td("e.g. Send property listings")}
                />
            </DealModalField>

            <div className="grid grid-cols-3 gap-3">
                <DealModalField label={td("Due date")}>
                    <input
                        type="date"
                        value={form.dueDate}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                dueDate: event.target.value,
                            }))
                        }
                    />
                </DealModalField>

                <DealModalField label={td("Due time")}>
                    <input
                        type="time"
                        value={form.dueTime}
                        disabled={!form.dueDate}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                dueTime: event.target.value,
                            }))
                        }
                    />
                </DealModalField>

                <DealModalField label={td("Priority")}>
                    <select
                        value={form.priority}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                priority: event.target.value as TaskPriority,
                            }))
                        }
                    >
                        <option value="high">{td("High")}</option>
                        <option value="medium">{td("Medium")}</option>
                        <option value="low">{td("Low")}</option>
                    </select>
                </DealModalField>
            </div>

            <DealModalField label={td("Assignees")}>
                <DealAssigneeField
                    value={form.assignees}
                    onChange={(assignees) =>
                        setForm((current) => ({ ...current, assignees }))
                    }
                    disabled={isCreating}
                />
            </DealModalField>

            <DealModalField label={td("Description")}>
                <textarea
                    value={form.description}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            description: event.target.value,
                        }))
                    }
                    placeholder={td("Optional details...")}
                    rows={3}
                    style={{ resize: "vertical" }}
                />
            </DealModalField>
        </DealModal>
    );
}
