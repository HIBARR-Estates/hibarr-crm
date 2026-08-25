import { ReactNode, useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import TaskStatusDropdownPill, {
    isCompletedColumn,
} from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { Task } from "@/Types/api/tasks";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import IntegrationOriginBadge from "@/Components/Redesign/primitives/IntegrationOriginBadge";
import PriorityBadge from "@/Components/Redesign/primitives/PriorityBadge";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import AssigneeField from "@/Components/Redesign/fields/AssigneeField";
import {
    formatDate,
    formatDateWithTime,
} from "@/Components/Redesign/adapters/dateFormat";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import {
    parseTaskDateTime,
    toDateInputValue,
    toTimeInputValue,
} from "@/lib/taskDateTime";

export interface TaskDetailUpdateInput {
    title: string;
    description: string;
    startDate: string;
    dueDate: string;
    dueTime: string;
    priority: "low" | "medium" | "high" | "highest" | "urgent";
    assignees: number[];
}

export interface TaskDetailModalLabels {
    viewTitle: string;
    editTitle: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    titleField: string;
    description: string;
    descriptionPlaceholder: string;
    startDate: string;
    dueDate: string;
    dueTime: string;
    priority: string;
    priorityHigh: string;
    priorityMedium: string;
    priorityLow: string;
    priorityHighest: string;
    priorityUrgent: string;
    assignees: string;
    overdue: string;
    noDescription: string;
    unassigned: string;
    dateRangeError: string;
}

interface EditFormState {
    title: string;
    description: string;
    startDate: string;
    dueDate: string;
    dueTime: string;
    priority: "low" | "medium" | "high" | "highest" | "urgent";
    assignees: number[];
}

const DEFAULT_DUE_TIME = "17:00";

function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}

function taskStatusSlug(task: Task): string {
    return (
        (task as Task & { board_column?: { slug?: string } }).board_column
            ?.slug ||
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
        dueTime: toTimeInputValue(task.due_date, DEFAULT_DUE_TIME),
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

interface TaskDetailModalProps {
    task: Task | null;
    taskBoardColumns: TaskboardColumn[];
    onClose: () => void;
    canWrite: boolean;
    isStatusPending: boolean;
    onStatusChange: (slug: string) => void;
    isUpdating: boolean;
    errors: string[];
    clearErrors: () => void;
    onUpdate: (input: TaskDetailUpdateInput, onSuccess?: () => void) => void;
    /** Entity-specific delete UI (e.g. DeleteTask modal). */
    deleteSlot?: ReactNode;
    onRequestDelete?: () => void;
    labels: TaskDetailModalLabels;
}

export default function TaskDetailModal({
    task,
    taskBoardColumns,
    onClose,
    canWrite,
    isStatusPending,
    onStatusChange,
    isUpdating,
    errors,
    clearErrors,
    onUpdate,
    deleteSlot,
    onRequestDelete,
    labels,
}: TaskDetailModalProps) {
    const { td } = useTd();
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<EditFormState | null>(null);

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
        isCompletedColumn(statusSlug, taskBoardColumns) ||
        Boolean(task.completed_on);
    const startDate = parseTaskDateTime(task.start_date);
    const dueDate = parseTaskDateTime(task.due_date);
    const dueLabel = formatDateWithTime(dueDate, "-");
    const overdue =
        !done && dueDate != null && dueDate.getTime() < Date.now();
    const assignees = task.users ?? [];
    const dirty = isDirty(form, task);
    const dateRangeError =
        form.startDate && form.dueDate && form.dueDate < form.startDate
            ? labels.dateRangeError
            : null;

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
        onUpdate(
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
        <Modal
            open={!!task}
            onClose={onClose}
            dirty={editing && dirty}
            title={editing ? labels.editTitle : labels.viewTitle}
            footer={
                editing ? (
                    <>
                        <Button
                            variant="ghost"
                            onClick={cancelEditing}
                            disabled={isUpdating}
                        >
                            {labels.cancel}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={saveChanges}
                            disabled={!dirty || isUpdating || !!dateRangeError}
                            loading={isUpdating}
                        >
                            {labels.save}
                        </Button>
                    </>
                ) : (
                    <>
                        {canWrite && onRequestDelete && (
                            <Button
                                variant="ghost"
                                style={{ color: T.RED }}
                                onClick={onRequestDelete}
                            >
                                {labels.delete}
                            </Button>
                        )}
                        <span style={{ flex: 1 }} />
                        {canWrite && (
                            <Button variant="primary" onClick={startEditing}>
                                {labels.edit}
                            </Button>
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
                    loading={isStatusPending}
                    disabled={editing || !canWrite}
                    onChange={onStatusChange}
                />
                <PriorityBadge priority={task.priority} />
                {overdue && (
                    <span className="dr-pill dr-pill-red">{labels.overdue}</span>
                )}
                <IntegrationOriginBadge origin={task.integration_origin} size={15} />
            </div>

            {editing ? (
                <>
                    <ModalField label={labels.titleField}>
                        <input
                            value={form.title}
                            autoFocus
                            disabled={isUpdating}
                            onChange={(e) =>
                                setForm({ ...form, title: e.target.value })
                            }
                        />
                    </ModalField>

                    <ModalField label={labels.description}>
                        <textarea
                            value={form.description}
                            disabled={isUpdating}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    description: e.target.value,
                                })
                            }
                            placeholder={labels.descriptionPlaceholder}
                            rows={4}
                            style={{ resize: "vertical" }}
                        />
                    </ModalField>

                    <div className="grid grid-cols-2 gap-3">
                        <ModalField label={labels.startDate}>
                            <input
                                type="date"
                                value={form.startDate}
                                disabled={isUpdating}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        startDate: e.target.value,
                                    })
                                }
                            />
                        </ModalField>
                        <ModalField label={labels.dueDate}>
                            <input
                                type="date"
                                value={form.dueDate}
                                disabled={isUpdating}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        dueDate: e.target.value,
                                    })
                                }
                            />
                        </ModalField>
                    </div>
                    {dateRangeError && (
                        <p className="-mt-2 mb-3 text-xs text-red-600">
                            {dateRangeError}
                        </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <ModalField label={labels.dueTime}>
                            <input
                                type="time"
                                value={form.dueTime}
                                disabled={isUpdating}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        dueTime: e.target.value,
                                    })
                                }
                            />
                        </ModalField>
                        <ModalField label={labels.priority}>
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
                                <option value="urgent">
                                    {labels.priorityUrgent}
                                </option>
                                <option value="highest">
                                    {labels.priorityHighest}
                                </option>
                                <option value="high">
                                    {labels.priorityHigh}
                                </option>
                                <option value="medium">
                                    {labels.priorityMedium}
                                </option>
                                <option value="low">{labels.priorityLow}</option>
                            </select>
                        </ModalField>
                    </div>

                    <ModalField label={labels.assignees}>
                        <AssigneeField
                            value={form.assignees}
                            onChange={(assignees) =>
                                setForm({ ...form, assignees })
                            }
                            disabled={isUpdating}
                        />
                    </ModalField>
                </>
            ) : (
                <>
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
                                {labels.dueDate}
                            </div>
                            <div
                                className="flex items-center gap-1.5"
                                style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: overdue ? T.RED : T.TEXT,
                                }}
                            >
                                <Icon name="calendar" size={14} />
                                {dueLabel}
                            </div>
                        </div>
                        <div>
                            <div className="dr-label" style={{ marginBottom: 5 }}>
                                {labels.startDate}
                            </div>
                            <div
                                className="flex items-center gap-1.5"
                                style={{ fontSize: 14, color: T.TEXT_MUTED }}
                            >
                                <Icon name="calendar" size={14} />
                                {formatDate(startDate, "-")}
                            </div>
                        </div>
                    </div>

                    <div className="mb-5">
                        {field(
                            labels.description,
                            <div
                                className="text-[14px] leading-relaxed"
                                style={{
                                    color: task.description
                                        ? T.TEXT
                                        : T.TEXT_MUTED,
                                    fontStyle: task.description
                                        ? "normal"
                                        : "italic",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {task.description || labels.noDescription}
                            </div>,
                        )}
                    </div>

                    <div className="mb-2">
                        {field(
                            labels.assignees,
                            assignees.length === 0 ? (
                                <div
                                    className="text-[14px] italic"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {labels.unassigned}
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
                                            <Avatar
                                                size={22}
                                                initials={initialsFromName(
                                                    user.name,
                                                )}
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

            {deleteSlot}
        </Modal>
    );
}
