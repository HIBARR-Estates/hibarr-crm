import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import AssigneeField from "@/Components/Redesign/fields/AssigneeField";

export type TaskPriority = "low" | "medium" | "high";

export interface AddTaskFormState {
    title: string;
    description: string;
    startDate: string;
    dueDate: string;
    dueTime: string;
    priority: TaskPriority;
    assignees: number[];
}

export interface AddTaskModalLabels {
    title: string;
    cancel: string;
    submit: string;
    titleField: string;
    titlePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    startDate: string;
    dueDate: string;
    dueTime: string;
    priority: string;
    priorityHigh: string;
    priorityMedium: string;
    priorityLow: string;
    assignees: string;
    dateRangeError: string;
}

const DEFAULT_DUE_TIME = "17:00";

function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}

function defaultAssignees(
    defaultAssigneeUserId?: number | null,
    currentUserId?: number,
): number[] {
    const assignees: number[] = [];
    if (defaultAssigneeUserId) {
        assignees.push(defaultAssigneeUserId);
    }
    if (currentUserId && currentUserId !== defaultAssigneeUserId) {
        assignees.push(currentUserId);
    }
    return assignees;
}

function buildInitialForm(
    defaultAssigneeUserId?: number | null,
    currentUserId?: number,
): AddTaskFormState {
    return {
        title: "",
        description: "",
        startDate: todayIsoDate(),
        dueDate: "",
        dueTime: DEFAULT_DUE_TIME,
        priority: "medium",
        assignees: defaultAssignees(defaultAssigneeUserId, currentUserId),
    };
}

interface AddTaskModalProps {
    open: boolean;
    onClose: () => void;
    saving: boolean;
    errors: string[];
    onSubmit: (form: AddTaskFormState) => void;
    labels: AddTaskModalLabels;
    /** Prefill assignee (e.g. deal agent / lead owner). */
    defaultAssigneeUserId?: number | null;
}

export default function AddTaskModal({
    open,
    onClose,
    saving,
    errors,
    onSubmit,
    labels,
    defaultAssigneeUserId,
}: AddTaskModalProps) {
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const [form, setForm] = useState<AddTaskFormState>(() =>
        buildInitialForm(defaultAssigneeUserId, currentUserId),
    );

    useEffect(() => {
        if (!open) {
            setForm(buildInitialForm(defaultAssigneeUserId, currentUserId));
        }
    }, [open, currentUserId, defaultAssigneeUserId]);

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    const dateRangeError =
        form.startDate && form.dueDate && form.dueDate < form.startDate
            ? labels.dateRangeError
            : null;

    const currentYear = new Date().getFullYear();
    const minDate = `${currentYear - 10}-01-01`;
    const maxDate = `${currentYear + 10}-12-31`;

    const handleSubmit = () => {
        if (dateRangeError) return;
        onSubmit(form);
    };

    return (
        <Modal
            open={open}
            title={labels.title}
            onClose={handleClose}
            footer={
                <>
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        disabled={saving}
                    >
                        {labels.cancel}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={saving}
                        disabled={
                            saving || !!dateRangeError || !form.title.trim()
                        }
                    >
                        {labels.submit}
                    </Button>
                </>
            }
        >
            {errors.length > 0 && (
                <div className="mb-3 space-y-1">
                    {errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600">
                            {td(error, { source: "en" })}
                        </p>
                    ))}
                </div>
            )}

            <ModalField label={labels.titleField}>
                <input
                    value={form.title}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            title: event.target.value,
                        }))
                    }
                    placeholder={labels.titlePlaceholder}
                />
            </ModalField>

            <ModalField label={labels.description}>
                <textarea
                    value={form.description}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            description: event.target.value,
                        }))
                    }
                    placeholder={labels.descriptionPlaceholder}
                    rows={3}
                    style={{ resize: "vertical" }}
                />
            </ModalField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ModalField label={labels.startDate}>
                    <input
                        type="date"
                        min={minDate}
                        max={maxDate}
                        value={form.startDate}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                startDate: event.target.value,
                            }))
                        }
                    />
                </ModalField>

                <ModalField label={labels.dueDate}>
                    <input
                        type="date"
                        min={minDate}
                        max={maxDate}
                        value={form.dueDate}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                dueDate: event.target.value,
                            }))
                        }
                    />
                </ModalField>
            </div>
            {dateRangeError && (
                <p className="-mt-2 mb-3 text-xs text-red-600">
                    {dateRangeError}
                </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ModalField label={labels.dueTime}>
                    <input
                        type="time"
                        value={form.dueTime}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                dueTime: event.target.value,
                            }))
                        }
                    />
                </ModalField>

                <ModalField label={labels.priority}>
                    <select
                        value={form.priority}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                priority: event.target.value as TaskPriority,
                            }))
                        }
                    >
                        <option value="high">{labels.priorityHigh}</option>
                        <option value="medium">{labels.priorityMedium}</option>
                        <option value="low">{labels.priorityLow}</option>
                    </select>
                </ModalField>
            </div>

            <ModalField label={labels.assignees}>
                <AssigneeField
                    value={form.assignees}
                    onChange={(assignees) =>
                        setForm((current) => ({ ...current, assignees }))
                    }
                    disabled={saving}
                />
            </ModalField>
        </Modal>
    );
}
