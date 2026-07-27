import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useDealTaskCreate from "../../hooks/useDealTaskCreate";
import { DEFAULT_DUE_TIME, todayIsoDate } from "../../hooks/taskDateUtils";
import DealButton from "../primitives/DealButton";
import { DealModal, DealModalField } from "../primitives/DealModal";
import DealAssigneeField from "./DealAssigneeField";

interface DealAddTaskModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
    /** Deal agent's user id — prefilled as an assignee so auto-assignment is visible. */
    dealAgentUserId?: number | null;
}

type TaskPriority = "low" | "medium" | "high";

interface TaskFormState {
    title: string;
    description: string;
    startDate: string;
    dueDate: string;
    dueTime: string;
    priority: TaskPriority;
    assignees: number[];
}

function defaultAssignees(
    dealAgentUserId?: number | null,
    currentUserId?: number,
): number[] {
    const assignees: number[] = [];
    if (dealAgentUserId) {
        assignees.push(dealAgentUserId);
    }
    if (currentUserId && currentUserId !== dealAgentUserId) {
        assignees.push(currentUserId);
    }
    return assignees;
}

function buildInitialForm(
    dealAgentUserId?: number | null,
    currentUserId?: number,
): TaskFormState {
    return {
        title: "",
        description: "",
        startDate: todayIsoDate(),
        dueDate: "",
        dueTime: DEFAULT_DUE_TIME,
        priority: "medium",
        assignees: defaultAssignees(dealAgentUserId, currentUserId),
    };
}

export default function DealAddTaskModal({
    open,
    onClose,
    dealId,
    dealAgentUserId,
}: DealAddTaskModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const [form, setForm] = useState<TaskFormState>(() =>
        buildInitialForm(dealAgentUserId, currentUserId),
    );
    const { createTask, isCreating, errors, clearErrors } =
        useDealTaskCreate(dealId);

    useEffect(() => {
        if (!open) {
            setForm(buildInitialForm(dealAgentUserId, currentUserId));
            clearErrors();
        }
    }, [clearErrors, open, currentUserId, dealAgentUserId]);

    const handleClose = () => {
        if (isCreating) return;
        onClose();
    };

    // Mirrors the backend's due_date after_or_equal:start_date rule
    // (StoreTask::rules) so the user sees this before submitting, not as a
    // server error after the fact.
    const dateRangeError =
        form.startDate && form.dueDate && form.dueDate < form.startDate
            ? t("pages.deals.workspace.tasks.date_range_error")
            : null;

    // Mirrors the backend's dateBoundsRule (StoreTask::rules /
    // UpdateTask::rules) — keeps the native date picker from ever showing a
    // typo year like 1220 as a selectable value in the first place.
    const currentYear = new Date().getFullYear();
    const minDate = `${currentYear - 10}-01-01`;
    const maxDate = `${currentYear + 10}-12-31`;

    const handleSubmit = () => {
        if (dateRangeError) return;
        createTask(
            {
                title: form.title,
                description: form.description,
                startDate: form.startDate,
                dueDate: form.dueDate,
                dueTime: form.dueTime,
                priority: form.priority,
                assignees: form.assignees,
            },
            handleClose,
        );
    };

    return (
        <DealModal
            open={open}
            title={t("pages.deals.workspace.tasks.add_task")}
            onClose={handleClose}
            footer={
                <>
                    <DealButton
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isCreating}
                    >
                        {t("pages.deals.common.cancel")}
                    </DealButton>
                    <DealButton
                        variant="primary"
                        onClick={handleSubmit}
                        loading={isCreating}
                        disabled={
                            isCreating || !!dateRangeError || !form.title.trim()
                        }
                    >
                        {t("pages.deals.workspace.tasks.create_task")}
                    </DealButton>
                </>
            }
        >
            {errors.length > 0 && (
                <div className="mb-3 space-y-1">
                    {errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600">
                            {td(error)}
                        </p>
                    ))}
                </div>
            )}

            <DealModalField label={t("pages.deals.workspace.tasks.title_field")}>
                <input
                    value={form.title}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            title: event.target.value,
                        }))
                    }
                    placeholder={t("pages.deals.workspace.tasks.title_placeholder")}
                />
            </DealModalField>

            <DealModalField label={t("pages.deals.common.description")}>
                <textarea
                    value={form.description}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            description: event.target.value,
                        }))
                    }
                    placeholder={t("pages.deals.common.optional_details_placeholder")}
                    rows={3}
                    style={{ resize: "vertical" }}
                />
            </DealModalField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DealModalField label={t("pages.deals.common.start_date")}>
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
                </DealModalField>

                <DealModalField label={t("pages.deals.common.due_date")}>
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
                </DealModalField>
            </div>
            {dateRangeError && (
                <p className="-mt-2 mb-3 text-xs text-red-600">{dateRangeError}</p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DealModalField label={t("pages.deals.common.due_time")}>
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
                </DealModalField>

                <DealModalField label={t("pages.deals.common.priority")}>
                    <select
                        value={form.priority}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                priority: event.target.value as TaskPriority,
                            }))
                        }
                    >
                        <option value="high">{t("pages.deals.common.priority_high")}</option>
                        <option value="medium">{t("pages.deals.common.priority_medium")}</option>
                        <option value="low">{t("pages.deals.common.priority_low")}</option>
                    </select>
                </DealModalField>
            </div>

            <DealModalField label={t("pages.deals.common.assignees")}>
                <DealAssigneeField
                    value={form.assignees}
                    onChange={(assignees) =>
                        setForm((current) => ({ ...current, assignees }))
                    }
                    disabled={isCreating}
                />
            </DealModalField>
        </DealModal>
    );
}
