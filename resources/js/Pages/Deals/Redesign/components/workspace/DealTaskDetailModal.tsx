import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import TaskStatusDropdownPill, {
    isCompletedColumn,
} from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import type { Task } from "@/Types/api/tasks";
import DealAvatar from "../primitives/DealAvatar";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import DealPriorityBadge from "../primitives/DealPriorityBadge";
import { DealModal, DealModalField } from "../primitives/DealModal";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealTaskStatus from "../../hooks/useDealTaskStatus";
import useDealTaskUpdate from "../../hooks/useDealTaskUpdate";
import { extractLocalTime, todayIsoDate } from "../../hooks/taskDateUtils";
import DealAssigneeField from "./DealAssigneeField";
import { formatDate, formatDateWithTime } from "../../adapters/dateFormat";
import { initialsFromName } from "../../adapters/initials";
import {
    parseTaskDateTime,
    toDateInputValue,
} from "@/lib/taskDateTime";

interface DealTaskDetailModalProps {
    task: Task | null;
    taskBoardColumns: TaskboardColumn[];
    onClose: () => void;
}

interface EditFormState {
    title: string;
    description: string;
    startDate: string;
    dueDate: string;
    dueTime: string;
    priority: "low" | "medium" | "high";
    assignees: number[];
}

function taskStatusSlug(task: Task): string {
    return (
        (task as Task & { board_column?: { slug?: string } }).board_column?.slug ||
        task.status ||
        "to_do"
    );
}

function toFormState(task: Task): EditFormState {
    return {
        title: task.heading,
        description: task.description || "",
        startDate: toDateInputValue(task.start_date) || todayIsoDate(),
        dueDate: toDateInputValue(task.due_date),
        dueTime: extractLocalTime(task.due_date),
        priority: task.priority,
        assignees: (task.users ?? []).map((user) => user.id),
    };
}

function isDirty(form: EditFormState, task: Task): boolean {
    const original = toFormState(task);
    return (
        form.title !== original.title ||
        form.description !== original.description ||
        form.startDate !== original.startDate ||
        form.dueDate !== original.dueDate ||
        (!!form.dueDate && form.dueTime !== original.dueTime) ||
        form.priority !== original.priority ||
        JSON.stringify([...form.assignees].sort()) !==
            JSON.stringify([...original.assignees].sort())
    );
}

/** v2.2 TaskDetailModal (deal-v2-2.jsx:2090-2267) — view + real status/edit/delete. */
export default function DealTaskDetailModal({
    task,
    taskBoardColumns,
    onClose,
}: DealTaskDetailModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<EditFormState | null>(null);
    const { setStatus, isPending: isStatusPending } = useDealTaskStatus();
    const { deal, setTasks } = useDealWorkspace();
    const { isWatcherOnly } = useDealPermissions(deal);
    const { updateTask, isUpdating, errors, clearErrors } = useDealTaskUpdate(
        task ?? ({ id: 0 } as Task),
    );

    useEffect(() => {
        if (task) {
            setEditing(false);
            setForm(toFormState(task));
            clearErrors();
        }
    }, [task, clearErrors]);

    if (!task || !form) return null;

    // Watchers stay read-only except on tasks they created (TaskController).
    const canWriteTask =
        !isWatcherOnly || task.added_by === userId;
    const statusSlug = taskStatusSlug(task);
    const done =
        isCompletedColumn(statusSlug, taskBoardColumns) || Boolean(task.completed_on);
    const startDate = parseTaskDateTime(task.start_date);
    const dueDate = parseTaskDateTime(task.due_date);
    const dueLabel = formatDateWithTime(dueDate, "-");
    const overdue =
        !done && dueDate != null && dueDate.getTime() < Date.now();
    const assignees = task.users ?? [];
    const dirty = isDirty(form, task);
    // Mirrors the backend's due_date after_or_equal:start_date rule
    // (UpdateTask::rules) so the user sees this before saving, not as a
    // server error after the fact.
    const dateRangeError =
        form.startDate && form.dueDate && form.dueDate < form.startDate
            ? t("pages.deals.workspace.tasks.date_range_error")
            : null;

    const handleStatusChange = (slug: string) => setStatus(task.id, slug);

    const startEditing = () => {
        setForm(toFormState(task));
        clearErrors();
        setEditing(true);
    };

    const cancelEditing = () => {
        setForm(toFormState(task));
        clearErrors();
        setEditing(false);
    };

    const saveChanges = () => {
        if (dateRangeError) return;
        updateTask(
            {
                title: form.title,
                description: form.description,
                startDate: form.startDate,
                dueDate: form.dueDate,
                dueTime: form.dueTime,
                priority: form.priority,
                assignees: form.assignees,
            },
            () => setEditing(false),
        );
    };

    const field = (label: string, children: React.ReactNode) => (
        <div>
            <div className="dr-label" style={{ marginBottom: 4 }}>
                {label}
            </div>
            {children}
        </div>
    );

    return (
        <DealModal
            open={!!task}
            onClose={onClose}
            dirty={editing && dirty}
            title={
                editing
                    ? t("pages.deals.workspace.tasks.edit_task")
                    : t("pages.deals.workspace.tasks.view_title")
            }
            footer={
                editing ? (
                    <>
                        <DealButton
                            variant="ghost"
                            onClick={cancelEditing}
                            disabled={isUpdating}
                        >
                            {t("pages.deals.common.cancel")}
                        </DealButton>
                        <DealButton
                            variant="primary"
                            onClick={saveChanges}
                            disabled={!dirty || isUpdating || !!dateRangeError}
                            loading={isUpdating}
                        >
                            {t("pages.deals.common.save_changes")}
                        </DealButton>
                    </>
                ) : (
                    <>
                        {canWriteTask && (
                            <DealButton
                                variant="ghost"
                                style={{ color: T.RED }}
                                onClick={() => setDeleteOpen(true)}
                            >
                                {t("pages.deals.workspace.tasks.delete_task")}
                            </DealButton>
                        )}
                        <span style={{ flex: 1 }} />
                        {canWriteTask && (
                            <DealButton variant="primary" onClick={startEditing}>
                                {t("pages.deals.workspace.tasks.edit_task")}
                            </DealButton>
                        )}
                    </>
                )
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

            {/* In view mode the task title leads — it is what the reader came
                for — with status/priority as supporting metadata beneath it.
                While editing the title lives in its own field, so only the
                badge row is shown. */}
            {!editing && (
                <div
                    className="mb-1.5 font-bold"
                    style={{
                        fontSize: 19,
                        lineHeight: 1.3,
                        color: T.TEXT,
                        textDecoration: done ? "line-through" : "none",
                    }}
                >
                    {task.heading}
                </div>
            )}

            <div className="mb-5 flex flex-wrap items-center gap-2.5">
                <TaskStatusDropdownPill
                    status={statusSlug}
                    columns={taskBoardColumns}
                    loading={isStatusPending(task.id)}
                    disabled={editing || !canWriteTask}
                    onChange={(slug) => handleStatusChange(slug)}
                />
                <DealPriorityBadge priority={task.priority} />
                {overdue && (
                    <span
                        className="dr-pill dr-pill-red"
                    >
                        {t("pages.deals.workspace.tasks.overdue")}
                    </span>
                )}
            </div>

            {editing ? (
                <>
                    <DealModalField label={t("pages.deals.workspace.tasks.title_field")}>
                        <input
                            value={form.title}
                            autoFocus
                            disabled={isUpdating}
                            onChange={(e) =>
                                setForm({ ...form, title: e.target.value })
                            }
                        />
                    </DealModalField>

                    <DealModalField label={t("pages.deals.common.description")}>
                        <textarea
                            value={form.description}
                            disabled={isUpdating}
                            onChange={(e) =>
                                setForm({ ...form, description: e.target.value })
                            }
                            placeholder={t("pages.deals.common.optional_details_placeholder")}
                            rows={4}
                            style={{ resize: "vertical" }}
                        />
                    </DealModalField>

                    <div className="grid grid-cols-2 gap-3">
                        <DealModalField label={t("pages.deals.common.start_date")}>
                            <input
                                type="date"
                                value={form.startDate}
                                disabled={isUpdating}
                                onChange={(e) =>
                                    setForm({ ...form, startDate: e.target.value })
                                }
                            />
                        </DealModalField>
                        <DealModalField label={t("pages.deals.common.due_date")}>
                            <input
                                type="date"
                                value={form.dueDate}
                                disabled={isUpdating}
                                onChange={(e) =>
                                    setForm({ ...form, dueDate: e.target.value })
                                }
                            />
                        </DealModalField>
                    </div>
                    {dateRangeError && (
                        <p className="-mt-2 mb-3 text-xs text-red-600">
                            {dateRangeError}
                        </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <DealModalField label={t("pages.deals.common.due_time")}>
                            <input
                                type="time"
                                value={form.dueTime}
                                disabled={isUpdating}
                                onChange={(e) =>
                                    setForm({ ...form, dueTime: e.target.value })
                                }
                            />
                        </DealModalField>
                        <DealModalField label={t("pages.deals.common.priority")}>
                            <select
                                value={form.priority}
                                disabled={isUpdating}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        priority: e.target
                                            .value as EditFormState["priority"],
                                    })
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
                                setForm({ ...form, assignees })
                            }
                            disabled={isUpdating}
                        />
                    </DealModalField>
                </>
            ) : (
                <>
                    {/* Due date is the operational fact people open a task for,
                        so it gets a panel and the largest type in the body —
                        turning red when overdue. */}
                    <div
                        className="mb-5 grid gap-3 rounded-xl sm:grid-cols-2"
                        style={{
                            background: overdue ? T.RED_SOFT : T.SURFACE_2,
                            border: `1px solid ${overdue ? T.RED_MID : T.BORDER}`,
                            padding: "14px 16px",
                        }}
                    >
                        <div>
                            <div className="dr-label" style={{ marginBottom: 5 }}>
                                {t("pages.deals.common.due_date")}
                            </div>
                            <div
                                className="flex items-center gap-1.5"
                                style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: overdue ? T.RED : T.TEXT,
                                }}
                            >
                                <DealIcon name="calendar" size={14} />
                                {dueLabel}
                            </div>
                        </div>
                        <div>
                            <div className="dr-label" style={{ marginBottom: 5 }}>
                                {t("pages.deals.common.start_date")}
                            </div>
                            <div
                                className="flex items-center gap-1.5"
                                style={{ fontSize: 14, color: T.TEXT_MUTED }}
                            >
                                <DealIcon name="calendar" size={14} />
                                {formatDate(startDate, "-")}
                            </div>
                        </div>
                    </div>

                    <div className="mb-5">
                        {field(
                            t("pages.deals.common.description"),
                            <div
                                className="text-[14px] leading-relaxed"
                                style={{
                                    color: task.description ? T.TEXT : T.TEXT_MUTED,
                                    fontStyle: task.description ? "normal" : "italic",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {task.description || t("pages.deals.common.no_description")}
                            </div>,
                        )}
                    </div>

                    <div className="mb-2">
                        {field(
                            t("pages.deals.common.assignees"),
                            assignees.length === 0 ? (
                                <div
                                    className="text-[14px] italic"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {t("pages.deals.common.unassigned")}
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                    {assignees.map((user) => (
                                        <span
                                            key={user.id}
                                            className="inline-flex items-center gap-1.5 rounded-full border py-[3px] pl-1 pr-2.5"
                                            style={{
                                                background: T.SURFACE_2,
                                                borderColor: T.BORDER,
                                            }}
                                        >
                                            <DealAvatar
                                                size={22}
                                                initials={initialsFromName(user.name)}
                                            />
                                            <span className="text-[13px]">
                                                {user.name}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            ),
                        )}
                    </div>
                </>
            )}

            <DeleteTask
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                task={{ id: task.id, heading: task.heading }}
                skipReload
                onDeleted={(taskId) => {
                    setDeleteOpen(false);
                    onClose();
                    setTasks((prev) => prev.filter((item) => item.id !== taskId));
                }}
            />
        </DealModal>
    );
}
