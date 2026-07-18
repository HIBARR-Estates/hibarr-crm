import { useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
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

function initialsFromName(name?: string): string {
    if (!name) return "--";
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function taskStatusSlug(task: Task): string {
    return (
        (task as Task & { board_column?: { slug?: string } }).board_column?.slug ||
        task.status ||
        "to_do"
    );
}

function formatDateLabel(date: Date | null): string {
    return date
        ? date.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
          })
        : "—";
}

function toFormState(task: Task): EditFormState {
    return {
        title: task.heading,
        description: task.description || "",
        startDate: task.start_date ? task.start_date.slice(0, 10) : todayIsoDate(),
        dueDate: task.due_date ? task.due_date.slice(0, 10) : "",
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
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<EditFormState | null>(null);
    const { setStatus, isPending: isStatusPending } = useDealTaskStatus();
    const { setTasks } = useDealWorkspace();
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

    const statusSlug = taskStatusSlug(task);
    const done =
        isCompletedColumn(statusSlug, taskBoardColumns) || Boolean(task.completed_on);
    const startDate = task.start_date ? new Date(task.start_date) : null;
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    const dueLabel = dueDate
        ? `${formatDateLabel(dueDate)} · ${dueDate.toLocaleTimeString("en-GB", {
              hour: "numeric",
              minute: "2-digit",
          })}`
        : "—";
    const overdue =
        !done && dueDate != null && dueDate.getTime() < Date.now();
    const assignees = task.users ?? [];
    const dirty = isDirty(form, task);
    // Mirrors the backend's due_date after_or_equal:start_date rule
    // (UpdateTask::rules) so the user sees this before saving, not as a
    // server error after the fact.
    const dateRangeError =
        form.startDate && form.dueDate && form.dueDate < form.startDate
            ? td("Due date can't be before the start date")
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
            title={editing ? td("Edit task") : td("Task")}
            footer={
                editing ? (
                    <>
                        <DealButton
                            variant="ghost"
                            onClick={cancelEditing}
                            disabled={isUpdating}
                        >
                            {td("Cancel")}
                        </DealButton>
                        <DealButton
                            variant="primary"
                            onClick={saveChanges}
                            disabled={!dirty || isUpdating || !!dateRangeError}
                            loading={isUpdating}
                        >
                            {td("Save changes")}
                        </DealButton>
                    </>
                ) : (
                    <>
                        <DealButton
                            variant="ghost"
                            style={{ color: T.RED }}
                            onClick={() => setDeleteOpen(true)}
                        >
                            {td("Delete task")}
                        </DealButton>
                        <span style={{ flex: 1 }} />
                        <DealButton variant="ghost" onClick={onClose}>
                            {td("Close")}
                        </DealButton>
                        <DealButton variant="primary" onClick={startEditing}>
                            {td("Edit task")}
                        </DealButton>
                    </>
                )
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

            <div className="mb-4 flex flex-wrap items-center gap-2.5">
                <TaskStatusDropdownPill
                    status={statusSlug}
                    columns={taskBoardColumns}
                    loading={isStatusPending(task.id)}
                    disabled={editing}
                    onChange={(slug) => handleStatusChange(slug)}
                />
                <DealPriorityBadge priority={task.priority} />
                {overdue && <span className="dr-pill dr-pill-red">{td("Overdue")}</span>}
            </div>

            {editing ? (
                <>
                    <DealModalField label={td("Task title")}>
                        <input
                            value={form.title}
                            autoFocus
                            disabled={isUpdating}
                            onChange={(e) =>
                                setForm({ ...form, title: e.target.value })
                            }
                        />
                    </DealModalField>

                    <DealModalField label={td("Description")}>
                        <textarea
                            value={form.description}
                            disabled={isUpdating}
                            onChange={(e) =>
                                setForm({ ...form, description: e.target.value })
                            }
                            placeholder={td("Optional details...")}
                            rows={4}
                            style={{ resize: "vertical" }}
                        />
                    </DealModalField>

                    <div className="grid grid-cols-2 gap-3">
                        <DealModalField label={td("Start date")}>
                            <input
                                type="date"
                                value={form.startDate}
                                disabled={isUpdating}
                                onChange={(e) =>
                                    setForm({ ...form, startDate: e.target.value })
                                }
                            />
                        </DealModalField>
                        <DealModalField label={td("Due date")}>
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
                        <DealModalField label={td("Due time")}>
                            <input
                                type="time"
                                value={form.dueTime}
                                disabled={isUpdating}
                                onChange={(e) =>
                                    setForm({ ...form, dueTime: e.target.value })
                                }
                            />
                        </DealModalField>
                        <DealModalField label={td("Priority")}>
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
                                setForm({ ...form, assignees })
                            }
                            disabled={isUpdating}
                        />
                    </DealModalField>
                </>
            ) : (
                <>
                    <div
                        className="mb-3.5 text-[15px] font-bold"
                        style={{ textDecoration: done ? "line-through" : "none" }}
                    >
                        {task.heading}
                    </div>

                    <div className="mb-3.5">
                        {field(
                            td("Description"),
                            <div
                                className="text-[13px] leading-relaxed"
                                style={{
                                    color: task.description ? T.TEXT : T.TEXT_MUTED,
                                    fontStyle: task.description ? "normal" : "italic",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {task.description || td("No description")}
                            </div>,
                        )}
                    </div>

                    <div className="mb-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
                        {field(
                            td("Start date"),
                            <div
                                className="flex items-center gap-1.5 text-[13px]"
                                style={{ color: T.TEXT }}
                            >
                                <DealIcon name="calendar" size={12} />
                                {formatDateLabel(startDate)}
                            </div>,
                        )}
                        {field(
                            td("Due date"),
                            <div
                                className="flex items-center gap-1.5 text-[13px]"
                                style={{
                                    color: overdue ? T.RED : T.TEXT,
                                    fontWeight: overdue ? 600 : 400,
                                }}
                            >
                                <DealIcon name="calendar" size={12} />
                                {dueLabel}
                            </div>,
                        )}
                    </div>

                    <div className="mb-3.5">
                        {field(
                            td("Assignees"),
                            assignees.length === 0 ? (
                                <div
                                    className="text-[13px] italic"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {td("Unassigned")}
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
                                                size={20}
                                                initials={initialsFromName(user.name)}
                                            />
                                            <span className="text-xs">{user.name}</span>
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
