import { useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useDealTaskCreate from "../../hooks/useDealTaskCreate";
import DealButton from "../primitives/DealButton";
import { DealModal, DealModalField } from "../primitives/DealModal";

interface DealAddTaskModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
}

type TaskPriority = "low" | "medium" | "high";

interface TaskFormState {
    title: string;
    due: string;
    priority: TaskPriority;
    description: string;
}

const INITIAL_FORM: TaskFormState = {
    title: "",
    due: "",
    priority: "medium",
    description: "",
};

export default function DealAddTaskModal({
    open,
    onClose,
    dealId,
}: DealAddTaskModalProps) {
    const { td } = useTd();
    const [form, setForm] = useState<TaskFormState>(INITIAL_FORM);
    const { createTask, isCreating, errors, clearErrors } =
        useDealTaskCreate(dealId);

    useEffect(() => {
        if (!open) {
            setForm(INITIAL_FORM);
            clearErrors();
        }
    }, [clearErrors, open]);

    const handleClose = () => {
        if (isCreating) return;
        onClose();
    };

    const handleSubmit = () => {
        createTask(
            {
                title: form.title,
                dueDate: form.due,
                priority: form.priority,
                description: form.description,
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
                        variant="navy"
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

            <DealModalField label={td("Due date")}>
                <input
                    type="date"
                    value={form.due}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            due: event.target.value,
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
