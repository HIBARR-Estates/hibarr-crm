import { useEffect, useMemo, useState } from "react";
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
import TaskColorSelect, {
    type ColorOption,
} from "./primitives/TaskColorSelect";

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
}

interface CategoryOption {
    id: number;
    category_name: string;
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
    columns: TaskboardColumn[];
    records: RecordPool;
    /**
     * Links the caller owns and the user may not remove — e.g. the deal when
     * the modal is opened from a deal workspace. Empty on the tasks page,
     * where any link can be detached.
     */
    lockedLinks?: TaskLinkRef[];
    /** Adds a category inline; resolves with the new option. */
    onCreateCategory?: (name: string) => Promise<CategoryOption | null>;
}

const DEFAULT_DUE_TIME = "17:00";

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

const LABEL: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: T.TEXT_MUTED,
};

const inputStyle: React.CSSProperties = {
    padding: "9px 12px",
    border: `1px solid ${T.BORDER}`,
    borderRadius: 8,
    fontSize: 14,
    color: T.TEXT,
    width: "100%",
    background: T.WHITE,
};

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
    };
}

const RECORD_TABS: RecordTypeKey[] = ["lead", "deal", "property", "project"];

/**
 * Create/edit task dialog built to the handoff's "Add task" layout: a
 * title-first form with optional fields, a linked-records picker, and the
 * rest tucked behind a "More details" disclosure.
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
    columns,
    records,
    lockedLinks = [],
    onCreateCategory,
}: TaskFormModalProps) {
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;

    const [form, setForm] = useState<TaskFormValues>(emptyForm);
    const [advanced, setAdvanced] = useState(false);
    const [recordType, setRecordType] = useState<RecordTypeKey>("lead");
    const [recordQuery, setRecordQuery] = useState("");
    const [newCategory, setNewCategory] = useState("");
    const [addingCategory, setAddingCategory] = useState(false);

    // Seed the form each time the modal opens.
    useEffect(() => {
        if (!open) return;
        const seeded = { ...emptyForm(), ...initial };
        // Locked links are always present and can't be removed.
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
        if (mode === "create" && seeded.assignees.length === 0 && currentUserId) {
            seeded.assignees = [currentUserId];
        }
        setForm(seeded);
        // Open "More details" straight away when the task already has links,
        // so existing relations aren't hidden behind a disclosure.
        setAdvanced(merged.length > 0);
        setRecordQuery("");
        setNewCategory("");
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
            if (event.key === "Escape" && !saving) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, saving]);

    const isLocked = (link: TaskLinkRef) =>
        lockedLinks.some(
            (locked) => locked.type === link.type && locked.id === link.id,
        );

    const dateRangeError =
        form.startDate && form.dueDate && form.dueDate < form.startDate
            ? td("Due date can't be before the start date")
            : null;

    /** Priority choices, each carrying its own arrow glyph and tint. */
    const priorityOptions: ColorOption[] = useMemo(
        () =>
            TASK_PRIORITY_ORDER.map((key) => {
                const token = TASK_PRIORITY[key];
                return {
                    value: key,
                    label: token.label,
                    color: token.color,
                    bg: token.bg,
                    fg: token.fg,
                    d: token.d,
                };
            }),
        [],
    );

    /** Category choices, coloured by the same palette as the row tag. */
    const categoryColorOptions: ColorOption[] = useMemo(
        () =>
            categories.map((category) => {
                const token = categoryToken(category.category_name);
                return {
                    value: String(category.id),
                    label: category.category_name,
                    color: token.dot,
                    bg: token.bg,
                    fg: token.fg,
                    square: true,
                };
            }),
        [categories],
    );

    const removeLink = (link: TaskLinkRef) =>
        setForm((current) => ({
            ...current,
            links: current.links.filter(
                (item) => !(item.type === link.type && item.id === link.id),
            ),
        }));

    const recordOptions = useMemo(() => {
        const pool = records[recordType] ?? [];
        const query = recordQuery.trim().toLowerCase();
        if (!query) return pool;
        return pool.filter((item) =>
            `${item.name} ${item.meta ?? ""}`.toLowerCase().includes(query),
        );
    }, [records, recordType, recordQuery]);

    if (!open || typeof document === "undefined") return null;

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
                        (link) =>
                            !(link.type === recordType && link.id === id),
                    ),
                };
            }
            return { ...current, links: [...current.links, candidate] };
        });
    };

    const handleAddCategory = async () => {
        const name = newCategory.trim();
        if (!name || !onCreateCategory) return;
        setAddingCategory(true);
        const created = await onCreateCategory(name);
        setAddingCategory(false);
        if (created) {
            setForm((current) => ({ ...current, categoryId: created.id }));
            setNewCategory("");
        }
    };

    const submit = () => {
        if (dateRangeError || !form.title.trim()) return;
        onSubmit(form);
    };

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
                    maxWidth: 520,
                    maxHeight: "88vh",
                    background: T.WHITE,
                    borderRadius: 14,
                    boxShadow: "0 20px 50px rgba(22,41,77,0.18)",
                }}
            >
                <div
                    className="flex items-center justify-between"
                    style={{
                        padding: "16px 22px",
                        background: T.SURFACE_2,
                        borderBottom: `1px solid ${T.BORDER}`,
                    }}
                >
                    <span
                        style={{ fontSize: 16, fontWeight: 700, color: T.NAVY }}
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
                    className="flex flex-col gap-[18px] overflow-y-auto"
                    style={{ padding: "20px 22px" }}
                >
                    {errors.length > 0 && (
                        <div className="flex flex-col gap-1">
                            {errors.map((error) => (
                                <p
                                    key={error}
                                    style={{ fontSize: 12, color: T.RED }}
                                >
                                    {td(error)}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* Title */}
                    <div className="flex flex-col gap-[7px]">
                        <input
                            value={form.title}
                            autoFocus
                            onChange={(event) =>
                                setForm((c) => ({
                                    ...c,
                                    title: event.target.value,
                                }))
                            }
                            placeholder={td("What needs to happen?")}
                            style={{
                                ...inputStyle,
                                padding: "12px 14px",
                                borderRadius: 10,
                                fontSize: 16,
                                fontWeight: 600,
                            }}
                        />
                        <div className="flex items-center gap-[7px] pl-0.5">
                            <TaskGlyph
                                d="M12 16v-4M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"
                                size={13}
                                color={T.TEXT_HINT}
                                strokeWidth={1.5}
                            />
                            <span
                                style={{ fontSize: 12, color: T.TEXT_HINT }}
                            >
                                {td(
                                    "Everything below is optional — hit save when the title is enough.",
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1.5">
                            <span style={LABEL}>{td("Start date")}</span>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={(event) =>
                                    setForm((c) => ({
                                        ...c,
                                        startDate: event.target.value,
                                    }))
                                }
                                style={inputStyle}
                            />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span style={LABEL}>{td("Due date")}</span>
                            <input
                                type="date"
                                value={form.dueDate}
                                onChange={(event) =>
                                    setForm((c) => ({
                                        ...c,
                                        dueDate: event.target.value,
                                    }))
                                }
                                style={inputStyle}
                            />
                        </label>
                    </div>
                    {dateRangeError && (
                        <p style={{ fontSize: 12, color: T.RED, marginTop: -10 }}>
                            {dateRangeError}
                        </p>
                    )}

                    {/* Priority + assignee */}
                    <div className="grid grid-cols-2 items-start gap-3">
                        <div className="flex flex-col gap-1.5">
                            <span style={LABEL}>{td("Priority")}</span>
                            <TaskColorSelect
                                value={form.priority}
                                options={priorityOptions}
                                placeholder={td("Select priority")}
                                clearable={false}
                                disabled={saving}
                                onChange={(value) =>
                                    setForm((c) => ({
                                        ...c,
                                        priority:
                                            (value as TaskPriorityKey) ??
                                            "medium",
                                    }))
                                }
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span style={LABEL}>{td("Assignee")}</span>
                            <AssigneeField
                                value={form.assignees}
                                onChange={(assignees) =>
                                    setForm((c) => ({ ...c, assignees }))
                                }
                                disabled={saving}
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div className="flex flex-col gap-2">
                        <span style={LABEL}>{td("Category")}</span>
                        <TaskColorSelect
                            value={
                                form.categoryId !== null
                                    ? String(form.categoryId)
                                    : null
                            }
                            options={categoryColorOptions}
                            placeholder={td("No category")}
                            disabled={saving}
                            onChange={(value) =>
                                setForm((c) => ({
                                    ...c,
                                    categoryId: value ? Number(value) : null,
                                }))
                            }
                        />
                        {onCreateCategory && (
                            <div className="flex items-center gap-2">
                                <input
                                    value={newCategory}
                                    onChange={(event) =>
                                        setNewCategory(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            void handleAddCategory();
                                        }
                                    }}
                                    placeholder={td("New category name")}
                                    style={{ ...inputStyle, fontSize: 13 }}
                                />
                                <button
                                    type="button"
                                    disabled={
                                        !newCategory.trim() || addingCategory
                                    }
                                    onClick={() => void handleAddCategory()}
                                    className="tasks-press"
                                    style={{
                                        flexShrink: 0,
                                        padding: "9px 12px",
                                        borderRadius: 8,
                                        border: `1px solid ${T.BORDER}`,
                                        background: T.WHITE,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: T.BLUE,
                                        cursor: "pointer",
                                        opacity:
                                            !newCategory.trim() ||
                                            addingCategory
                                                ? 0.5
                                                : 1,
                                    }}
                                >
                                    {addingCategory ? td("Adding…") : td("Add")}
                                </button>
                            </div>
                        )}
                    </div>


                    {/* More details */}
                    <div
                        style={{
                            borderTop: `1px solid ${T.BORDER_SOFT}`,
                            paddingTop: 12,
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setAdvanced((value) => !value)}
                            className="inline-flex items-center gap-[7px]"
                            style={{
                                padding: 0,
                                background: "transparent",
                                border: "none",
                                fontSize: 13,
                                fontWeight: 600,
                                color: T.BLUE,
                                cursor: "pointer",
                            }}
                        >
                            <span
                                style={{
                                    display: "flex",
                                    transform: advanced
                                        ? "rotate(180deg)"
                                        : "rotate(0deg)",
                                    transition: "transform 160ms ease",
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.chevron}
                                    size={14}
                                    strokeWidth={2}
                                />
                            </span>
                            {advanced ? td("Hide details") : td("More details")}
                        </button>
                    </div>
                    {advanced && (
                        <div className="tasks-reveal flex flex-col gap-4">
                            <label className="flex flex-col gap-1.5">
                                <span style={LABEL}>{td("Description")}</span>
                                <textarea
                                    rows={3}
                                    value={form.description}
                                    onChange={(event) =>
                                        setForm((c) => ({
                                            ...c,
                                            description: event.target.value,
                                        }))
                                    }
                                    placeholder={td(
                                        "Context the assignee will need",
                                    )}
                                    style={{
                                        ...inputStyle,
                                        resize: "vertical",
                                    }}
                                />
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span style={LABEL}>{td("Due time")}</span>
                                <input
                                    type="time"
                                    value={form.dueTime}
                                    onChange={(event) =>
                                        setForm((c) => ({
                                            ...c,
                                            dueTime: event.target.value,
                                        }))
                                    }
                                    style={inputStyle}
                                />
                            </label>

                            <div className="flex flex-col gap-1.5">
                                <span style={LABEL}>{td("Status")}</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {[...columns]
                                        .sort((a, b) => a.priority - b.priority)
                                        .map((column) => {
                                            const token = statusToken(
                                                column.slug,
                                            );
                                            const active =
                                                form.boardColumnId === column.id;
                                            return (
                                                <button
                                                    key={column.id}
                                                    type="button"
                                                    onClick={() =>
                                                        setForm((c) => ({
                                                            ...c,
                                                            boardColumnId:
                                                                active
                                                                    ? null
                                                                    : column.id,
                                                        }))
                                                    }
                                                    className="tasks-press inline-flex flex-1 items-center justify-center gap-1.5"
                                                    style={{
                                                        padding: "7px 10px",
                                                        borderRadius: 8,
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        cursor: "pointer",
                                                        background: active
                                                            ? token.bg
                                                            : T.WHITE,
                                                        color: active
                                                            ? token.fg
                                                            : T.TEXT_MUTED,
                                                        border: `1px solid ${active ? token.border : T.BORDER}`,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            width: 6,
                                                            height: 6,
                                                            borderRadius: 999,
                                                            background:
                                                                token.dot,
                                                        }}
                                                    />
                                                    {td(column.column_name, {
                                                        source: "en",
                                                    })}
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Linked records */}
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span style={LABEL}>
                                        {td("Linked records")}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: T.TEXT_HINT,
                                        }}
                                    >
                                        {form.links.length
                                            ? `${form.links.length} ${td("linked")}`
                                            : td("None yet")}
                                    </span>
                                </div>

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
                                                        padding:
                                                            "5px 8px 5px 7px",
                                                        borderRadius: 8,
                                                        background: def.iconBg,
                                                        border: `1px solid ${T.BORDER}`,
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: T.NAVY,
                                                    }}
                                                >
                                                    <TaskGlyph
                                                        d={def.d}
                                                        size={13}
                                                        color={def.iconFg}
                                                        strokeWidth={1.5}
                                                    />
                                                    {link.name}
                                                    {locked ? (
                                                        <span
                                                            title={td(
                                                                "Linked from this record and can't be removed here.",
                                                            )}
                                                            style={{
                                                                fontSize: 11,
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
                                                                removeLink(link)
                                                            }
                                                            style={{
                                                                display: "flex",
                                                                background:
                                                                    "transparent",
                                                                border: "none",
                                                                padding: 1,
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            <TaskGlyph
                                                                d={TASK_ICON.x}
                                                                size={12}
                                                                color={
                                                                    T.TEXT_MUTED
                                                                }
                                                                strokeWidth={2}
                                                            />
                                                        </button>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

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
                                                    fontSize: 12,
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
                                                <TaskGlyph
                                                    d={def.d}
                                                    size={13}
                                                    strokeWidth={1.5}
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
                                            setRecordQuery(event.target.value)
                                        }
                                        placeholder={`${td("Search")} ${td(RECORD_TYPES[recordType].plural)}`}
                                        style={{
                                            width: "100%",
                                            padding: "9px 12px",
                                            border: "none",
                                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                            fontSize: 13,
                                        }}
                                    />
                                    <div
                                        style={{
                                            maxHeight: 150,
                                            overflowY: "auto",
                                        }}
                                    >
                                        {recordOptions.map((option) => {
                                            const def =
                                                RECORD_TYPES[recordType];
                                            const picked = form.links.some(
                                                (link) =>
                                                    link.type === recordType &&
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
                                                        <TaskGlyph
                                                            d={def.d}
                                                            size={14}
                                                            color={def.iconFg}
                                                            strokeWidth={1.5}
                                                        />
                                                    </span>
                                                    <span className="flex min-w-0 flex-1 flex-col">
                                                        <span
                                                            className="truncate"
                                                            style={{
                                                                fontSize: 14,
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
                                                                    fontSize: 12,
                                                                    color: T.TEXT_MUTED,
                                                                }}
                                                            >
                                                                {option.meta}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {picked && (
                                                        <TaskGlyph
                                                            d={TASK_ICON.check}
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
                                                    fontSize: 13,
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
                        </div>
                    )}
                </div>

                <div
                    className="flex items-center justify-end gap-2.5"
                    style={{
                        padding: "14px 22px",
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
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {td("Cancel")}
                    </button>
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
                            fontSize: 13,
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
