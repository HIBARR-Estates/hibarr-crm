import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import AssigneeField from "@/Components/Redesign/fields/AssigneeField";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import {
    RECORD_TYPES,
    TASK_ICON,
    TASK_PRIORITY,
    TASK_PRIORITY_ORDER,
    categoryToken,
    statusToken,
    type RecordTypeKey,
    type TaskPriorityKey,
} from "../config/taskDesignTokens";
import { TaskGlyph } from "./primitives/TaskGlyphs";
import TaskPillSelect, { type PillOption } from "./primitives/TaskPillSelect";
import TaskDateSelect from "./primitives/TaskDateSelect";
import TaskRecordIcon from "./primitives/TaskRecordIcon";

export interface TaskLinkRef {
    type: RecordTypeKey;
    id: number;
    name: string;
}

export interface TaskFormValues {
    title: string;
    description: string;
    startDate: string;
    dueDate: string;
    dueTime: string;
    priority: TaskPriorityKey;
    assignees: number[];
    categoryId: number | null;
    boardColumnId: number | null;
    links: TaskLinkRef[];
    /** New checklist rows to create against the saved task. */
    checklist: string[];
    /** New files to upload once the task exists. */
    files: File[];
}

interface CategoryOption {
    id: number;
    category_name: string;
}

interface UserOption {
    id: number;
    name: string;
}

export interface RecordPool {
    deal: Array<{ id: number; name: string; meta?: string }>;
    lead: Array<{ id: number; name: string; meta?: string }>;
    property: Array<{ id: number; name: string; meta?: string }>;
    project: Array<{ id: number; name: string; meta?: string }>;
}

interface TaskFormModalProps {
    open: boolean;
    mode: "create" | "edit";
    onClose: () => void;
    onSubmit: (values: TaskFormValues) => void;
    saving: boolean;
    errors: string[];
    initial?: Partial<TaskFormValues>;
    categories: CategoryOption[];
    /** Employees, used to name a lone assignee on the pill. */
    users?: UserOption[];
    columns: TaskboardColumn[];
    records: RecordPool;
    /**
     * Links the caller owns and the user may not remove — e.g. the deal when
     * the modal is opened from a deal workspace.
     */
    lockedLinks?: TaskLinkRef[];
}

const DEFAULT_DUE_TIME = "17:00";
const RECORD_TABS: RecordTypeKey[] = ["lead", "deal", "property", "project"];

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function emptyForm(): TaskFormValues {
    return {
        title: "",
        description: "",
        startDate: todayIso(),
        dueDate: "",
        dueTime: DEFAULT_DUE_TIME,
        priority: "medium",
        assignees: [],
        categoryId: null,
        boardColumnId: null,
        links: [],
        checklist: [],
        files: [],
    };
}

const MICRO_LABEL: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: T.TEXT_MUTED,
};

const popoverStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 60,
    border: `1px solid ${T.BORDER}`,
    borderRadius: 10,
    background: T.WHITE,
    boxShadow: "0 8px 24px rgba(22,41,77,0.14)",
};

const smallInput: React.CSSProperties = {
    padding: "8px 10px",
    border: `1px solid ${T.BORDER}`,
    borderRadius: 8,
    fontSize: 15,
    color: T.TEXT,
    background: T.WHITE,
    width: "100%",
};

/**
 * Create/edit task dialog, rebuilt to the handoff's compact layout: a
 * borderless title + description, then one pill per field that opens its
 * editor in an anchored popover — so the dialog stays short instead of
 * stacking every field down the page. Checklist and attachments sit inline
 * below, always available rather than hidden behind a menu.
 */
export default function TaskFormModal({
    open,
    mode,
    onClose,
    onSubmit,
    saving,
    errors,
    initial,
    categories,
    users = [],
    columns,
    records,
    lockedLinks = [],
}: TaskFormModalProps) {
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;

    const [form, setForm] = useState<TaskFormValues>(emptyForm);
    // Status/priority/category manage their own menus (TaskPillSelect);
    // only these two need an explicit anchored popover.
    const [assigneeOpen, setAssigneeOpen] = useState(false);
    const [linksOpen, setLinksOpen] = useState(false);
    const [anchor, setAnchor] = useState<{ top: number; left: number }>({
        top: 0,
        left: 0,
    });
    const [recordType, setRecordType] = useState<RecordTypeKey>("lead");
    const [recordQuery, setRecordQuery] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        const seeded = { ...emptyForm(), ...initial };
        const merged = [...seeded.links];
        lockedLinks.forEach((locked) => {
            if (
                !merged.some(
                    (link) =>
                        link.type === locked.type && link.id === locked.id,
                )
            ) {
                merged.push(locked);
            }
        });
        seeded.links = merged;
        seeded.checklist = [];
        seeded.files = [];
        if (
            mode === "create" &&
            seeded.assignees.length === 0 &&
            currentUserId
        ) {
            seeded.assignees = [currentUserId];
        }
        setForm(seeded);
        setAssigneeOpen(false);
        setLinksOpen(false);
        setRecordQuery("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open || typeof document === "undefined") return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            // Escape closes an anchored popover first, then the dialog.
            if (assigneeOpen || linksOpen) {
                setAssigneeOpen(false);
                setLinksOpen(false);
            } else if (!saving) {
                onClose();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, saving, assigneeOpen, linksOpen]);

    const isLocked = (link: TaskLinkRef) =>
        lockedLinks.some(
            (locked) => locked.type === link.type && locked.id === link.id,
        );

    const dateRangeError =
        form.startDate && form.dueDate && form.dueDate < form.startDate
            ? td("Due date can't be before the start date")
            : null;

    const recordOptions = useMemo(() => {
        const pool = records[recordType] ?? [];
        const query = recordQuery.trim().toLowerCase();
        if (!query) return pool;
        return pool.filter((item) =>
            `${item.name} ${item.meta ?? ""}`.toLowerCase().includes(query),
        );
    }, [records, recordType, recordQuery]);

    if (!open || typeof document === "undefined") return null;

    /** Opens the assignee picker anchored under its pill. */
    const toggleAssignee = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setLinksOpen(false);
        if (assigneeOpen) {
            setAssigneeOpen(false);
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        setAnchor({
            top: rect.bottom + 6,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)),
        });
        setAssigneeOpen(true);
    };

    /** Board columns as pill options. */
    const statusOptions: PillOption[] = columns
        .slice()
        .sort((a, b) => a.priority - b.priority)
        .map((column) => {
            const token = statusToken(column.slug);
            return {
                value: String(column.id),
                label: column.column_name,
                bg: token.bg,
                fg: token.fg,
                border: token.border,
                dot: token.dot,
            };
        });

    /** Priorities as pill options, each with its arrow glyph. */
    const priorityOptions: PillOption[] = TASK_PRIORITY_ORDER.map((key) => {
        const token = TASK_PRIORITY[key];
        return {
            value: key,
            label: token.label,
            bg: token.bg,
            fg: token.fg,
            border: token.border,
            dot: token.color,
            d: token.d,
        };
    });

    /** Categories as pill options, coloured like the row tag. */
    const categoryOptions: PillOption[] = categories.map((category) => {
        // category.category_name always a real string here, so categoryToken
        // never actually returns its "no name" null.
        const token = categoryToken(category.category_name)!;
        return {
            value: String(category.id),
            label: category.category_name,
            bg: token.bg,
            fg: token.fg,
            border: token.border,
            dot: token.dot,
            square: true,
        };
    });

    const toggleLink = (id: number, name: string) => {
        const candidate: TaskLinkRef = { type: recordType, id, name };
        setForm((current) => {
            const exists = current.links.some(
                (link) => link.type === recordType && link.id === id,
            );
            if (exists) {
                if (isLocked(candidate)) return current;
                return {
                    ...current,
                    links: current.links.filter(
                        (link) => !(link.type === recordType && link.id === id),
                    ),
                };
            }
            return { ...current, links: [...current.links, candidate] };
        });
    };

    const submit = () => {
        if (dateRangeError || !form.title.trim()) return;
        onSubmit({
            ...form,
            checklist: form.checklist.filter((item) => item.trim() !== ""),
        });
    };

    const currentStatus = columns.find(
        (column) => column.id === form.boardColumnId,
    );
    const statusTok = statusToken(currentStatus?.slug);
    const priorityTok = TASK_PRIORITY[form.priority];
    const currentCategory = categories.find(
        (category) => category.id === form.categoryId,
    );
    const categoryTok = currentCategory
        ? categoryToken(currentCategory.category_name)
        : null;
    // A lone assignee reads as their name; zero or many keep the count.
    const assigneeLabel = (() => {
        if (form.assignees.length === 0) return td("Unassigned");
        if (form.assignees.length === 1) {
            const only = users.find((user) => user.id === form.assignees[0]);
            if (only?.name) return only.name;
        }
        return `${form.assignees.length} ${td("assignees")}`;
    })();

    const chevron = (
        <TaskGlyph d={TASK_ICON.chevron} size={12} strokeWidth={2} />
    );

    return createPortal(
        <div
            className="redesign-modal-overlay tasks-modal-overlay"
            role="presentation"
            onClick={() => !saving && onClose()}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(22,41,77,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
                padding: 24,
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={
                    mode === "create" ? td("Add task") : td("Edit task")
                }
                onClick={(event) => event.stopPropagation()}
                className="tasks-modal-panel flex w-full flex-col overflow-hidden"
                style={{
                    width: "fit-content",
                    minWidth: 640,
                    maxWidth: "min(1040px, 94vw)",
                    background: T.WHITE,
                    borderRadius: 12,
                    boxShadow: "0 20px 50px rgba(22,41,77,0.18)",
                }}
            >
                <div
                    className="flex items-center justify-between"
                    style={{
                        padding: "14px 24px",
                        borderBottom: `1px solid ${T.BORDER}`,
                    }}
                >
                    <span
                        style={{ fontSize: 20, fontWeight: 700, color: T.NAVY }}
                    >
                        {mode === "create" ? td("Add task") : td("Edit task")}
                    </span>
                    <button
                        type="button"
                        aria-label={td("Close")}
                        onClick={() => !saving && onClose()}
                        style={{
                            display: "flex",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        <TaskGlyph
                            d={TASK_ICON.x}
                            size={17}
                            color={T.TEXT_MUTED}
                            strokeWidth={1.5}
                        />
                    </button>
                </div>

                <div
                    className="flex flex-col gap-3.5 overflow-y-auto"
                    style={{
                        padding: "20px 24px 24px",
                        // Roughly half the old stacked form: the pills keep
                        // every field one click away instead of on the page.
                        minHeight: 300,
                        maxHeight: "70vh",
                    }}
                >
                    {errors.length > 0 && (
                        <div className="flex flex-col gap-1">
                            {errors.map((error) => (
                                <p
                                    key={error}
                                    style={{ fontSize: 14, color: T.RED }}
                                >
                                    {td(error)}
                                </p>
                            ))}
                        </div>
                    )}

                    <input
                        value={form.title}
                        autoFocus
                        onChange={(event) =>
                            setForm((c) => ({
                                ...c,
                                title: event.target.value,
                            }))
                        }
                        className="tasks-bare-input"
                        placeholder={td("Task name")}
                        style={{
                            border: "none",
                            padding: 0,
                            fontSize: 23,
                            fontWeight: 700,
                            color: T.TEXT,
                            outline: "none",
                        }}
                    />
                    <textarea
                        rows={2}
                        value={form.description}
                        onChange={(event) =>
                            setForm((c) => ({
                                ...c,
                                description: event.target.value,
                            }))
                        }
                        className="tasks-bare-input"
                        placeholder={td("Add description")}
                        style={{
                            border: "none",
                            padding: 0,
                            fontSize: 16,
                            color: T.TEXT_MUTED,
                            resize: "vertical",
                            minHeight: 108,
                            outline: "none",
                        }}
                    />

                    {/* One pill dropdown per field, matching the list view */}
                    <div className="flex flex-nowrap items-center gap-[7px] overflow-x-auto pt-0.5">
                        <TaskPillSelect
                            value={
                                form.boardColumnId !== null
                                    ? String(form.boardColumnId)
                                    : null
                            }
                            options={statusOptions}
                            placeholder={td("Status")}
                            menuHeading={td("Move to")}
                            disabled={saving}
                            onChange={(value) =>
                                setForm((c) => ({
                                    ...c,
                                    boardColumnId: value ? Number(value) : null,
                                }))
                            }
                        />

                        <button
                            type="button"
                            onClick={toggleAssignee}
                            className="tasks-press inline-flex items-center gap-1.5 whitespace-nowrap"
                            style={{
                                padding: "7px 13px",
                                borderRadius: 6,
                                fontSize: 15,
                                fontWeight: 600,
                                lineHeight: 1.5,
                                background: form.assignees.length
                                    ? T.BLUE_LIGHT
                                    : T.WHITE,
                                color: form.assignees.length
                                    ? T.BLUE_DARK
                                    : T.TEXT_MUTED,
                                border: `1px solid ${form.assignees.length ? T.BLUE_MID : T.BORDER}`,
                                cursor: "pointer",
                            }}
                        >
                            <TaskGlyph
                                d={TASK_ICON.user}
                                size={13}
                                strokeWidth={1.5}
                            />
                            {assigneeLabel}
                            <span style={{ display: "flex", opacity: 0.6 }}>
                                <TaskGlyph
                                    d={TASK_ICON.chevron}
                                    size={11}
                                    strokeWidth={1.5}
                                />
                            </span>
                        </button>

                        <TaskDateSelect
                            startDate={form.startDate}
                            dueDate={form.dueDate}
                            dueTime={form.dueTime}
                            disabled={saving}
                            error={dateRangeError}
                            onChange={(next) =>
                                setForm((c) => ({ ...c, ...next }))
                            }
                        />

                        <TaskPillSelect
                            value={form.priority}
                            options={priorityOptions}
                            placeholder={td("Priority")}
                            disabled={saving}
                            onChange={(value) =>
                                setForm((c) => ({
                                    ...c,
                                    priority:
                                        (value as TaskPriorityKey) ?? "medium",
                                }))
                            }
                        />

                        <TaskPillSelect
                            value={
                                form.categoryId !== null
                                    ? String(form.categoryId)
                                    : null
                            }
                            options={categoryOptions}
                            placeholder={td("Category")}
                            clearable
                            columns={categoryOptions.length > 6 ? 2 : 1}
                            menuWidth={categoryOptions.length > 6 ? 320 : 240}
                            disabled={saving}
                            onChange={(value) =>
                                setForm((c) => ({
                                    ...c,
                                    categoryId: value ? Number(value) : null,
                                }))
                            }
                        />

                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setAssigneeOpen(false);
                                if (linksOpen) {
                                    setLinksOpen(false);
                                    return;
                                }
                                const rect =
                                    event.currentTarget.getBoundingClientRect();
                                setAnchor({
                                    top: rect.bottom + 6,
                                    left: Math.max(
                                        8,
                                        Math.min(
                                            rect.left,
                                            window.innerWidth - 380,
                                        ),
                                    ),
                                });
                                setLinksOpen(true);
                            }}
                            className="tasks-press inline-flex items-center gap-1.5 whitespace-nowrap"
                            style={{
                                padding: "7px 13px",
                                borderRadius: 6,
                                fontSize: 15,
                                fontWeight: 600,
                                lineHeight: 1.5,
                                background: form.links.length
                                    ? T.BLUE_LIGHT
                                    : T.WHITE,
                                color: form.links.length
                                    ? T.BLUE_DARK
                                    : T.TEXT_MUTED,
                                border: `1px solid ${form.links.length ? T.BLUE_MID : T.BORDER}`,
                                cursor: "pointer",
                            }}
                        >
                            <TaskGlyph
                                d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"
                                size={13}
                                strokeWidth={1.5}
                            />
                            {form.links.length
                                ? `${form.links.length} ${td("linked")}`
                                : td("Linked items")}
                            <span style={{ display: "flex", opacity: 0.6 }}>
                                <TaskGlyph
                                    d={TASK_ICON.chevron}
                                    size={11}
                                    strokeWidth={1.5}
                                />
                            </span>
                        </button>
                    </div>

                    {/* Assignee picker, anchored under its pill */}
                    {assigneeOpen &&
                        createPortal(
                            <>
                                <div
                                    role="presentation"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setAssigneeOpen(false);
                                    }}
                                    style={{
                                        position: "fixed",
                                        inset: 0,
                                        zIndex: 59,
                                    }}
                                />
                                <div
                                    className="tasks-reveal"
                                    onClick={(event) => event.stopPropagation()}
                                    style={{
                                        position: "fixed",
                                        top: anchor.top,
                                        left: anchor.left,
                                        zIndex: 60,
                                        width: 280,
                                        padding: 12,
                                        background: T.WHITE,
                                        border: `1px solid ${T.BORDER}`,
                                        borderRadius: 12,
                                        boxShadow:
                                            "0 16px 36px rgba(22,41,77,0.16)",
                                    }}
                                >
                                    <AssigneeField
                                        value={form.assignees}
                                        onChange={(assignees) =>
                                            setForm((c) => ({
                                                ...c,
                                                assignees,
                                            }))
                                        }
                                        disabled={saving}
                                    />
                                </div>
                            </>,
                            document.body,
                        )}

                    {/* Linked-records picker, anchored under the "…" menu */}
                    {linksOpen &&
                        createPortal(
                            <>
                                <div
                                    role="presentation"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setLinksOpen(false);
                                    }}
                                    style={{
                                        position: "fixed",
                                        inset: 0,
                                        zIndex: 59,
                                    }}
                                />
                                <div
                                    className="tasks-reveal flex flex-col gap-2.5"
                                    onClick={(event) => event.stopPropagation()}
                                    style={{
                                        position: "fixed",
                                        top: anchor.top,
                                        left: anchor.left,
                                        zIndex: 60,
                                        width: 360,
                                        padding: 12,
                                        background: T.WHITE,
                                        border: `1px solid ${T.BORDER}`,
                                        borderRadius: 12,
                                        boxShadow:
                                            "0 16px 36px rgba(22,41,77,0.16)",
                                    }}
                                >
                                    <div className="flex flex-wrap gap-1.5">
                                        {RECORD_TABS.map((key) => {
                                            const def = RECORD_TYPES[key];
                                            const active = recordType === key;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        setRecordType(key);
                                                        setRecordQuery("");
                                                    }}
                                                    className="tasks-press inline-flex items-center gap-1.5"
                                                    style={{
                                                        padding: "6px 11px",
                                                        borderRadius: 8,
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        cursor: "pointer",
                                                        background: active
                                                            ? T.NAVY
                                                            : T.WHITE,
                                                        color: active
                                                            ? T.WHITE
                                                            : T.TEXT_MUTED,
                                                        border: `1px solid ${active ? T.NAVY : T.BORDER}`,
                                                    }}
                                                >
                                                    <TaskRecordIcon
                                                        type={key}
                                                        size={13}
                                                    />
                                                    {td(def.label)}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div
                                        style={{
                                            border: `1px solid ${T.BORDER}`,
                                            borderRadius: 8,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <input
                                            value={recordQuery}
                                            onChange={(event) =>
                                                setRecordQuery(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder={`${td("Search")} ${td(RECORD_TYPES[recordType].plural)}`}
                                            style={{
                                                width: "100%",
                                                padding: "9px 12px",
                                                border: "none",
                                                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                                fontSize: 15,
                                            }}
                                        />
                                        <div
                                            style={{
                                                maxHeight: 180,
                                                overflowY: "auto",
                                            }}
                                        >
                                            {recordOptions.map((option) => {
                                                const def =
                                                    RECORD_TYPES[recordType];
                                                const picked = form.links.some(
                                                    (link) =>
                                                        link.type ===
                                                            recordType &&
                                                        link.id === option.id,
                                                );
                                                return (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={() =>
                                                            toggleLink(
                                                                option.id,
                                                                option.name,
                                                            )
                                                        }
                                                        className="tasks-record-row flex w-full items-center gap-2.5"
                                                        style={{
                                                            padding: "9px 12px",
                                                            border: "none",
                                                            borderBottom:
                                                                "1px solid #f2f4f7",
                                                            background: picked
                                                                ? T.BLUE_LIGHT
                                                                : T.WHITE,
                                                            cursor: "pointer",
                                                            textAlign: "left",
                                                        }}
                                                    >
                                                        <span
                                                            className="flex flex-shrink-0 items-center justify-center"
                                                            style={{
                                                                width: 26,
                                                                height: 26,
                                                                borderRadius: 6,
                                                                background:
                                                                    def.iconBg,
                                                            }}
                                                        >
                                                            <TaskRecordIcon
                                                                type={
                                                                    recordType
                                                                }
                                                                size={14}
                                                                color={
                                                                    def.iconFg
                                                                }
                                                            />
                                                        </span>
                                                        <span className="flex min-w-0 flex-1 flex-col">
                                                            <span
                                                                className="truncate"
                                                                style={{
                                                                    fontSize: 16,
                                                                    fontWeight:
                                                                        picked
                                                                            ? 600
                                                                            : 500,
                                                                    color: T.TEXT,
                                                                }}
                                                            >
                                                                {option.name}
                                                            </span>
                                                            {option.meta && (
                                                                <span
                                                                    className="truncate"
                                                                    style={{
                                                                        fontSize: 14,
                                                                        color: T.TEXT_MUTED,
                                                                    }}
                                                                >
                                                                    {
                                                                        option.meta
                                                                    }
                                                                </span>
                                                            )}
                                                        </span>
                                                        {picked && (
                                                            <TaskGlyph
                                                                d={
                                                                    TASK_ICON.check
                                                                }
                                                                size={15}
                                                                color={T.BLUE}
                                                            />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                            {recordOptions.length === 0 && (
                                                <div
                                                    style={{
                                                        padding: "14px 12px",
                                                        fontSize: 15,
                                                        color: T.TEXT_HINT,
                                                    }}
                                                >
                                                    {td(
                                                        "Nothing matches that search.",
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>,
                            document.body,
                        )}

                    {/* Linked-record chips stay visible outside the popover */}
                    {form.links.length > 0 && (
                        <div className="flex flex-wrap gap-[7px]">
                            {form.links.map((link) => {
                                const def = RECORD_TYPES[link.type];
                                const locked = isLocked(link);
                                return (
                                    <span
                                        key={`${link.type}-${link.id}`}
                                        className="tasks-chip-in inline-flex items-center gap-[7px]"
                                        style={{
                                            padding: "5px 8px 5px 7px",
                                            borderRadius: 8,
                                            background: def.iconBg,
                                            border: `1px solid ${T.BORDER}`,
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: T.NAVY,
                                        }}
                                    >
                                        <TaskRecordIcon
                                            type={link.type}
                                            size={13}
                                            color={def.iconFg}
                                        />
                                        {link.name}
                                        {locked ? (
                                            <span
                                                title={td(
                                                    "Linked from this record and can't be removed here.",
                                                )}
                                                style={{
                                                    fontSize: 13,
                                                    color: T.TEXT_HINT,
                                                }}
                                            >
                                                {td("locked")}
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                aria-label={`${td("Remove")} ${link.name}`}
                                                onClick={() =>
                                                    setForm((c) => ({
                                                        ...c,
                                                        links: c.links.filter(
                                                            (item) =>
                                                                !(
                                                                    item.type ===
                                                                        link.type &&
                                                                    item.id ===
                                                                        link.id
                                                                ),
                                                        ),
                                                    }))
                                                }
                                                style={{
                                                    display: "flex",
                                                    background: "transparent",
                                                    border: "none",
                                                    padding: 1,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <TaskGlyph
                                                    d={TASK_ICON.x}
                                                    size={12}
                                                    color={T.TEXT_MUTED}
                                                    strokeWidth={2}
                                                />
                                            </button>
                                        )}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* Checklist — always available, no disclosure */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span style={MICRO_LABEL}>{td("Checklist")}</span>
                            <button
                                type="button"
                                aria-label={td("Add checklist item")}
                                title={td("Add checklist item")}
                                onClick={() =>
                                    setForm((c) => ({
                                        ...c,
                                        checklist: [...c.checklist, ""],
                                    }))
                                }
                                className="tasks-press inline-flex items-center justify-center"
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 999,
                                    border: `1px solid ${T.BORDER}`,
                                    background: T.WHITE,
                                    color: T.BLUE,
                                    cursor: "pointer",
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.plus}
                                    size={12}
                                    strokeWidth={2}
                                />
                            </button>
                        </div>
                        {form.checklist.map((item, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-2"
                            >
                                <span
                                    style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: 999,
                                        border: `1.5px solid ${T.NAVY_MID}`,
                                        flexShrink: 0,
                                    }}
                                />
                                <input
                                    value={item}
                                    autoFocus={
                                        index === form.checklist.length - 1
                                    }
                                    onChange={(event) =>
                                        setForm((c) => {
                                            const next = [...c.checklist];
                                            next[index] = event.target.value;
                                            return { ...c, checklist: next };
                                        })
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            setForm((c) => ({
                                                ...c,
                                                checklist: [...c.checklist, ""],
                                            }));
                                        }
                                    }}
                                    placeholder={td("Checklist item")}
                                    style={{
                                        ...smallInput,
                                        border: "none",
                                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                        borderRadius: 0,
                                        padding: "4px 0",
                                        fontSize: 16,
                                    }}
                                />
                                <button
                                    type="button"
                                    aria-label={td("Remove item")}
                                    onClick={() =>
                                        setForm((c) => ({
                                            ...c,
                                            checklist: c.checklist.filter(
                                                (_, i) => i !== index,
                                            ),
                                        }))
                                    }
                                    style={{
                                        display: "flex",
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    <TaskGlyph
                                        d={TASK_ICON.x}
                                        size={12}
                                        color={T.TEXT_HINT}
                                        strokeWidth={2}
                                    />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Attachments — always available, no disclosure */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span style={MICRO_LABEL}>{td("Attachments")}</span>
                            <button
                                type="button"
                                aria-label={td("Attach files")}
                                title={td("Attach files")}
                                disabled={saving}
                                onClick={() => fileInputRef.current?.click()}
                                className="tasks-press inline-flex items-center justify-center"
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 999,
                                    border: `1px solid ${T.BORDER}`,
                                    background: T.WHITE,
                                    color: T.BLUE,
                                    cursor: "pointer",
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.plus}
                                    size={12}
                                    strokeWidth={2}
                                />
                            </button>
                        </div>

                        {form.files.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                                {form.files.map((file, index) => (
                                    <div
                                        key={`${file.name}-${index}`}
                                        className="tasks-chip-in flex items-center gap-2.5"
                                        style={{
                                            padding: "8px 10px",
                                            background: T.SURFACE_2,
                                            border: `1px solid ${T.BORDER_SOFT}`,
                                            borderRadius: 8,
                                        }}
                                    >
                                        <span
                                            className="flex flex-shrink-0 items-center justify-center"
                                            style={{
                                                width: 26,
                                                height: 26,
                                                borderRadius: 6,
                                                background: T.BLUE_LIGHT,
                                            }}
                                        >
                                            <TaskGlyph
                                                d={TASK_ICON.file}
                                                size={13}
                                                color={T.BLUE_DARK}
                                                strokeWidth={1.5}
                                            />
                                        </span>
                                        <span
                                            className="min-w-0 flex-1 truncate"
                                            style={{
                                                fontSize: 15,
                                                fontWeight: 500,
                                                color: T.TEXT,
                                            }}
                                            title={file.name}
                                        >
                                            {file.name}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 13,
                                                color: T.TEXT_HINT,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {formatFileSize(file.size)}
                                        </span>
                                        <button
                                            type="button"
                                            aria-label={`${td("Remove")} ${file.name}`}
                                            onClick={() =>
                                                setForm((c) => ({
                                                    ...c,
                                                    files: c.files.filter(
                                                        (_, i) => i !== index,
                                                    ),
                                                }))
                                            }
                                            className="tasks-press"
                                            style={{
                                                display: "flex",
                                                background: "transparent",
                                                border: "none",
                                                cursor: "pointer",
                                                flexShrink: 0,
                                                padding: 3,
                                            }}
                                        >
                                            <TaskGlyph
                                                d={TASK_ICON.x}
                                                size={13}
                                                color={T.TEXT_MUTED}
                                                strokeWidth={2}
                                            />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={saving}
                                className="tasks-press"
                                style={{
                                    padding: "10px",
                                    borderRadius: 8,
                                    border: `1px dashed ${T.BORDER}`,
                                    background: T.SURFACE_2,
                                    color: T.TEXT_HINT,
                                    fontSize: 14,
                                    cursor: "pointer",
                                    textAlign: "left",
                                }}
                            >
                                {td(
                                    "No files attached yet — click to add some.",
                                )}
                            </button>
                        )}
                    </div>
                </div>

                <div
                    className="flex items-center gap-2.5"
                    style={{
                        padding: "14px 24px",
                        borderTop: `1px solid ${T.BORDER}`,
                    }}
                >
                    <button
                        type="button"
                        onClick={() => !saving && onClose()}
                        className="tasks-press"
                        style={{
                            padding: "9px 16px",
                            borderRadius: 8,
                            background: T.WHITE,
                            color: T.TEXT_MUTED,
                            border: `1px solid ${T.BORDER}`,
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {td("Cancel")}
                    </button>

                    <span className="flex-1" />

                    {/* Attach picker itself lives in the Attachments section
                        above — this input is shared by both entry points. */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        hidden
                        onChange={(event) => {
                            const picked = Array.from(event.target.files ?? []);
                            if (picked.length) {
                                setForm((c) => ({
                                    ...c,
                                    files: [...c.files, ...picked],
                                }));
                            }
                            event.target.value = "";
                        }}
                    />

                    <button
                        type="button"
                        onClick={submit}
                        disabled={
                            saving || !form.title.trim() || !!dateRangeError
                        }
                        className="tasks-press"
                        style={{
                            padding: "9px 16px",
                            borderRadius: 8,
                            background: T.BLUE,
                            color: T.WHITE,
                            border: `1px solid ${T.BLUE}`,
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                            opacity:
                                saving || !form.title.trim() || !!dateRangeError
                                    ? 0.6
                                    : 1,
                        }}
                    >
                        {saving
                            ? td("Saving…")
                            : mode === "create"
                              ? td("Add task")
                              : td("Save changes")}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
