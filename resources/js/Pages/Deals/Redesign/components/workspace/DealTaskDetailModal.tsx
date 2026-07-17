import { useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { taskApi } from "@/lib/api/tasks";
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
import useDealTaskUpdate from "../../hooks/useDealTaskUpdate";
import DealAssigneeField from "./DealAssigneeField";

interface DealTaskDetailModalProps {
    task: Task | null;
    taskBoardColumns: TaskboardColumn[];
    onClose: () => void;
}

interface EditFormState {
    title: string;
    description: string;
    dueDate: string;
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

function toFormState(task: Task): EditFormState {
    return {
        title: task.heading,
        description: task.description || "",
        dueDate: task.due_date ? task.due_date.slice(0, 10) : "",
        priority: task.priority,
        assignees: (task.users ?? []).map((user) => user.id),
    };
}

function isDirty(form: EditFormState, task: Task): boolean {
    const original = toFormState(task);
    return (
        form.title !== original.title ||
        form.description !== original.description ||
        form.dueDate !== original.dueDate ||
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
    const { mutate: updateStatus, isPending: isStatusUpdating } =
        taskApi.useUpdateStatus();
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
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    const dueLabel = dueDate
        ? dueDate.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
          })
        : "—";
    const overdue =
        !done && dueDate != null && dueDate.getTime() < Date.now();
    const assignees = task.users ?? [];
    const dirty = isDirty(form, task);

    const handleStatusChange = (slug: string) => {
        updateStatus(
            { taskId: task.id, status: slug },
            {
                onSuccess: () =>
                    setTasks((prev) =>
                        prev.map((item) =>
                            item.id === task.id ? { ...item, status: slug } : item,
                        ),
                    ),
            },
        );
    };

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
        updateTask(
            {
                title: form.title,
                description: form.description,
                dueDate: form.dueDate,
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
                            disabled={!dirty || isUpdating}
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
                    loading={isStatusUpdating}
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
                    <div className="grid grid-cols-2 gap-3">
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
                </>
            ) : (
                <>
                    <div
                        className="mb-3.5 text-[15px] font-bold"
                        style={{ textDecoration: done ? "line-through" : "none" }}
                    >
                        {task.heading}
                    </div>

                    <div className="mb-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
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
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {assignees.map((user) => (
                                        <span
                                            key={user.id}
                                            className="inline-flex items-center gap-1.5"
                                        >
                                            <DealAvatar
                                                size={18}
                                                initials={initialsFromName(user.name)}
                                            />
                                            <span className="text-xs">{user.name}</span>
                                        </span>
                                    ))}
                                </div>
                            ),
                        )}
                    </div>

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
