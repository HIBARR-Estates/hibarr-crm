import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import {
    TASK_ICON,
    TASK_PRIORITY,
    TASK_PRIORITY_ORDER,
    assigneeTone,
    categoryToken,
    statusToken,
} from "../config/taskDesignTokens";
import { TaskGlyph } from "./primitives/TaskGlyphs";
import type { TaskViewModel } from "../adapters/taskViewModel";
import type { TaskSavedView } from "../hooks/useTaskSavedViews";

interface CategoryOption {
    id: number;
    category_name: string;
}

interface UserOption {
    id: number;
    name: string;
    image?: string;
}

export type DueWindow =
    | "any"
    | "overdue"
    | "today"
    | "week"
    | "none"
    | "custom";

/**
 * The staged filter set the modal edits before committing. Every dimension
 * except the due window is multi-select, matching the leads filter modal.
 */
export interface FilterDraft {
    priority: string[];
    status: string[];
    categoryId: string[];
    assignedTo: string[];
    assignedBy: string[];
    due: DueWindow;
    from: string;
    to: string;
}

export interface TaskFilterState {
    status?: string | string[];
    priority?: string | string[];
    assigned_to?: number | string | Array<number | string>;
    assigned_by?: number | string | Array<number | string>;
    category_id?: number | string | Array<number | string>;
    due_date_range?: string | string[];
    search?: string;
}

/** Normalises a scalar-or-array filter value to a string array. */
function toList(value: unknown): string[] {
    if (value === null || value === undefined || value === "") return [];
    const list = Array.isArray(value) ? value : [value];
    return list
        .filter((item) => item !== null && item !== undefined && item !== "")
        .map((item) => String(item));
}

/** Adds or removes a value from a staged multi-select list. */
function toggle(list: string[], value: string): string[] {
    return list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];
}

interface TaskFiltersModalProps {
    open: boolean;
    onClose: () => void;
    /** Applied filters, used to seed the draft each time the modal opens. */
    filters: TaskFilterState;
    /** All loaded tasks — drives the live counts while staging. */
    tasks: TaskViewModel[];
    columns: TaskboardColumn[];
    categories: CategoryOption[];
    users: UserOption[];
    savedViews: TaskSavedView[];
    /** Commits the staged draft as query params (a single navigation). */
    onApply: (params: Record<string, unknown>) => void;
    onSaveView: (
        payload: {
            name: string;
            visibility: "private" | "team";
            pinned: boolean;
        },
        filters: Record<string, unknown>,
    ) => void;
    onDeleteView: (id: number) => void;
    savingView: boolean;
}

const SECTIONS = [
    { key: "general", label: "General" },
    { key: "assignment", label: "Assignment" },
    { key: "category", label: "Category" },
    { key: "due", label: "Due date" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const DUE_ITEMS: Array<{ key: DueWindow; label: string }> = [
    { key: "any", label: "Any" },
    { key: "overdue", label: "Overdue" },
    { key: "today", label: "Today" },
    { key: "week", label: "Upcoming" },
    { key: "none", label: "No date" },
    { key: "custom", label: "Custom" },
];

const LABEL: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: T.TEXT_MUTED,
};

function chipStyle(active: boolean): React.CSSProperties {
    return {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 13px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        background: active ? T.BLUE_LIGHT : T.WHITE,
        color: active ? T.BLUE_DARK : T.TEXT,
        border: `1px solid ${active ? T.BLUE_MID : T.BORDER}`,
        transition: "background 120ms ease",
    };
}

const EMPTY_DRAFT: FilterDraft = {
    priority: [],
    status: [],
    categoryId: [],
    assignedTo: [],
    assignedBy: [],
    due: "any",
    from: "",
    to: "",
};

/** [from, to] for the preset due windows. */
export function dueRange(window: DueWindow): [string, string] | null {
    const today = dayjs();
    const ymd = (value: dayjs.Dayjs) => value.format("YYYY-MM-DD");
    if (window === "today") return [ymd(today), ymd(today)];
    if (window === "week") return [ymd(today), ymd(today.add(7, "day"))];
    if (window === "overdue") {
        return [ymd(today.subtract(5, "year")), ymd(today.subtract(1, "day"))];
    }
    return null;
}

/** Rebuilds the draft from whatever is currently applied in the URL. */
function draftFromFilters(filters: TaskFilterState): FilterDraft {
    const range = Array.isArray(filters.due_date_range)
        ? filters.due_date_range
        : null;

    let due: DueWindow = "any";
    let from = "";
    let to = "";

    if (filters.due_date_range === "none") {
        due = "none";
    } else if (range) {
        const preset = (["overdue", "today", "week"] as DueWindow[]).find(
            (window) => {
                const preset = dueRange(window);
                return (
                    preset && preset[0] === range[0] && preset[1] === range[1]
                );
            },
        );
        if (preset) {
            due = preset;
        } else {
            due = "custom";
            from = range[0] ?? "";
            to = range[1] ?? "";
        }
    }

    return {
        priority: toList(filters.priority),
        status: toList(filters.status),
        categoryId: toList(filters.category_id),
        assignedTo: toList(filters.assigned_to),
        assignedBy: toList(filters.assigned_by),
        due,
        from,
        to,
    };
}

/** Turns a draft into the query params the tasks index understands. */
export function draftToParams(draft: FilterDraft): Record<string, unknown> {
    let dueParam: unknown = null;
    if (draft.due === "none") {
        dueParam = "none";
    } else if (draft.due === "custom") {
        dueParam = draft.from && draft.to ? [draft.from, draft.to] : null;
    } else {
        dueParam = dueRange(draft.due);
    }

    // Empty arrays must go out as null so mergeQueryParams drops the key.
    const list = (values: string[]) => (values.length ? values : null);

    return {
        priority: list(draft.priority),
        status: list(draft.status),
        category_id: list(draft.categoryId),
        assigned_to: list(draft.assignedTo),
        assigned_by: list(draft.assignedBy),
        due_date_range: dueParam,
    };
}

function countActive(draft: FilterDraft): number {
    return (
        draft.priority.length +
        draft.status.length +
        draft.categoryId.length +
        draft.assignedTo.length +
        draft.assignedBy.length +
        (draft.due === "any" ? 0 : 1)
    );
}

/**
 * Full filter dialog from the handoff. Selections are staged locally — counts
 * and the "current list" readout update live — and only committed as a single
 * navigation when Apply filters is pressed ("build then send").
 */
export default function TaskFiltersModal({
    open,
    onClose,
    filters,
    tasks,
    columns,
    categories,
    users,
    savedViews,
    onApply,
    onSaveView,
    onDeleteView,
    savingView,
}: TaskFiltersModalProps) {
    const { td } = useTd();
    const [draft, setDraft] = useState<FilterDraft>(EMPTY_DRAFT);
    const [section, setSection] = useState<SectionKey>("general");
    const [agentQuery, setAgentQuery] = useState("");
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [viewName, setViewName] = useState("");
    const [viewVisibility, setViewVisibility] =
        useState<"private" | "team">("private");

    const scrollRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Re-seed the draft from the applied filters every time the modal opens.
    useEffect(() => {
        if (open) {
            setDraft(draftFromFilters(filters));
            setShowSaveForm(false);
            setAgentQuery("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    /**
     * Does this task satisfy the draft, ignoring one dimension? Mirrors the
     * template's `matchesPanel(t, skip)` so each chip's count reflects what
     * picking it would yield.
     */
    const matches = useMemo(
        () =>
            (vm: TaskViewModel, skip?: keyof FilterDraft): boolean => {
                if (skip !== "priority" && draft.priority.length) {
                    if (!draft.priority.includes(vm.task.priority)) return false;
                }
                if (skip !== "status" && draft.status.length) {
                    if (!draft.status.includes(vm.statusSlug)) return false;
                }
                if (skip !== "categoryId" && draft.categoryId.length) {
                    const id = String(vm.task.category?.id ?? "");
                    if (!draft.categoryId.includes(id)) return false;
                }
                if (skip !== "assignedTo" && draft.assignedTo.length) {
                    const assigned = vm.people.some((person) =>
                        draft.assignedTo.includes(String(person.id)),
                    );
                    if (!assigned) return false;
                }
                if (skip !== "assignedBy" && draft.assignedBy.length) {
                    const creator = String(
                        vm.task.added_by ?? vm.task.created_by?.id ?? "",
                    );
                    if (!draft.assignedBy.includes(creator)) return false;
                }
                if (skip !== "due" && draft.due !== "any") {
                    if (draft.due === "none") {
                        if (vm.bucket !== "unscheduled") return false;
                    } else if (draft.due === "overdue") {
                        if (vm.bucket !== "overdue") return false;
                    } else if (draft.due === "today") {
                        if (vm.bucket !== "today") return false;
                    } else if (draft.due === "week") {
                        if (vm.bucket !== "upcoming") return false;
                    } else if (draft.due === "custom") {
                        const due = vm.task.due_date?.slice(0, 10);
                        if (!due) return false;
                        if (draft.from && due < draft.from) return false;
                        if (draft.to && due > draft.to) return false;
                    }
                }
                return true;
            },
        [draft],
    );

    const filteredCount = useMemo(
        () => tasks.filter((vm) => matches(vm)).length,
        [tasks, matches],
    );

    const countFor = (
        dimension: keyof FilterDraft,
        test: (vm: TaskViewModel) => boolean,
    ) => tasks.filter((vm) => matches(vm, dimension) && test(vm)).length;

    const sectionCounts: Record<SectionKey, number> = {
        general: draft.priority.length + draft.status.length,
        assignment: draft.assignedTo.length + draft.assignedBy.length,
        category: draft.categoryId.length,
        due: draft.due === "any" ? 0 : 1,
    };
    const totalActive = countActive(draft);

    const tokens = useMemo(() => {
        const list: Array<{ label: string; onRemove: () => void }> = [];

        draft.priority.forEach((key) => {
            list.push({
                label: `${td("Priority")}: ${td(
                    TASK_PRIORITY[key as keyof typeof TASK_PRIORITY]?.label ??
                        key,
                )}`,
                onRemove: () =>
                    setDraft((current) => ({
                        ...current,
                        priority: toggle(current.priority, key),
                    })),
            });
        });
        draft.status.forEach((slug) => {
            const column = columns.find((c) => c.slug === slug);
            list.push({
                label: `${td("Status")}: ${td(column?.column_name ?? slug, { source: "en" })}`,
                onRemove: () =>
                    setDraft((current) => ({
                        ...current,
                        status: toggle(current.status, slug),
                    })),
            });
        });
        draft.categoryId.forEach((id) => {
            const category = categories.find((c) => String(c.id) === id);
            list.push({
                label: `${td("Category")}: ${category?.category_name ?? id}`,
                onRemove: () =>
                    setDraft((current) => ({
                        ...current,
                        categoryId: toggle(current.categoryId, id),
                    })),
            });
        });
        draft.assignedTo.forEach((id) => {
            const user = users.find((u) => String(u.id) === id);
            list.push({
                label: `${td("To")}: ${user?.name ?? id}`,
                onRemove: () =>
                    setDraft((current) => ({
                        ...current,
                        assignedTo: toggle(current.assignedTo, id),
                    })),
            });
        });
        draft.assignedBy.forEach((id) => {
            const user = users.find((u) => String(u.id) === id);
            list.push({
                label: `${td("By")}: ${user?.name ?? id}`,
                onRemove: () =>
                    setDraft((current) => ({
                        ...current,
                        assignedBy: toggle(current.assignedBy, id),
                    })),
            });
        });

        if (draft.due !== "any") {
            list.push({
                label: `${td("Due")}: ${td(DUE_ITEMS.find((d) => d.key === draft.due)?.label ?? "")}`,
                onRemove: () =>
                    setDraft((current) => ({
                        ...current,
                        due: "any",
                        from: "",
                        to: "",
                    })),
            });
        }
        return list;
    }, [draft, columns, categories, users, td]);

    const filteredUsers = useMemo(() => {
        const query = agentQuery.trim().toLowerCase();
        return query
            ? users.filter((user) => user.name.toLowerCase().includes(query))
            : users;
    }, [users, agentQuery]);

    if (!open || typeof document === "undefined") return null;

    const scrollToSection = (key: SectionKey) => {
        setSection(key);
        const element = sectionRefs.current[key];
        const container = scrollRef.current;
        if (element && container) container.scrollTop = element.offsetTop - 4;
    };

    const onScroll = () => {
        const container = scrollRef.current;
        if (!container) return;
        let active: SectionKey = "general";
        SECTIONS.forEach(({ key }) => {
            const element = sectionRefs.current[key];
            if (element && element.offsetTop - 24 <= container.scrollTop) {
                active = key;
            }
        });
        if (active !== section) setSection(active);
    };

    const sectionBlock = (
        key: SectionKey,
        title: string,
        children: React.ReactNode,
        first = false,
    ) => (
        <div
            ref={(element) => {
                sectionRefs.current[key] = element;
            }}
            className="flex flex-col gap-4"
            style={{ paddingTop: first ? 0 : 28 }}
        >
            <span style={LABEL}>{td(title)}</span>
            {children}
        </div>
    );

    const fieldHeader = (label: string, selectedCount: number) => (
        <div className="flex items-baseline gap-2.5">
            <span style={{ fontSize: 14, fontWeight: 600, color: T.TEXT }}>
                {td(label)}
            </span>
            {selectedCount > 0 && (
                <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                    {selectedCount} {td("selected")}
                </span>
            )}
        </div>
    );

    /** Checkbox + avatar agent list, shared by "Assigned to" and "Assigned by". */
    const agentList = (
        dimension: "assignedTo" | "assignedBy",
        test: (vm: TaskViewModel, userId: number) => boolean,
    ) => {
        const selected = draft[dimension];
        return (
            <div
                style={{
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 10,
                    overflow: "hidden",
                }}
            >
                <input
                    value={agentQuery}
                    onChange={(event) => setAgentQuery(event.target.value)}
                    placeholder={td("Search agents...")}
                    style={{
                        width: "100%",
                        padding: "11px 14px",
                        border: "none",
                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        fontSize: 13,
                        color: T.TEXT,
                    }}
                />
                <div style={{ maxHeight: 186, overflowY: "auto" }}>
                    {filteredUsers.map((user) => {
                        const active = selected.includes(String(user.id));
                        const count = countFor(dimension, (vm) =>
                            test(vm, user.id),
                        );
                        return (
                            <button
                                key={user.id}
                                type="button"
                                onClick={() =>
                                    setDraft((current) => ({
                                        ...current,
                                        [dimension]: toggle(
                                            current[dimension],
                                            String(user.id),
                                        ),
                                    }))
                                }
                                className="tasks-record-row flex w-full items-center gap-3"
                                style={{
                                    padding: "9px 14px",
                                    border: "none",
                                    borderBottom: "1px solid #f2f4f7",
                                    background: active ? "#eaf2fe" : T.WHITE,
                                    cursor: "pointer",
                                    textAlign: "left",
                                }}
                            >
                                <span
                                    className="flex flex-shrink-0 items-center justify-center"
                                    style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: 4,
                                        border: `1.5px solid ${active ? T.BLUE : "#c7d0de"}`,
                                        background: active ? T.BLUE : T.WHITE,
                                    }}
                                >
                                    <TaskGlyph
                                        d={TASK_ICON.check}
                                        size={11}
                                        color={T.WHITE}
                                        strokeWidth={3}
                                    />
                                </span>
                                <Avatar
                                    size={26}
                                    initials={initialsFromName(user.name)}
                                    src={user.image}
                                    tone={assigneeTone(user.id)}
                                />
                                <span
                                    className="min-w-0 flex-1 truncate"
                                    style={{
                                        fontSize: 14,
                                        fontWeight: active ? 600 : 500,
                                        color: T.TEXT,
                                    }}
                                >
                                    {user.name}
                                </span>
                                <span
                                    style={{
                                        fontSize: 13,
                                        color: T.TEXT_HINT,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                    {filteredUsers.length === 0 && (
                        <div
                            style={{
                                padding: 14,
                                fontSize: 13,
                                color: T.TEXT_HINT,
                            }}
                        >
                            {td("No agents match that search.")}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return createPortal(
        <div
            className="redesign-modal-overlay"
            role="presentation"
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(22,41,77,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 52,
                padding: 28,
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={td("Filter tasks")}
                onClick={(event) => event.stopPropagation()}
                className="flex w-full flex-col overflow-hidden"
                style={{
                    maxWidth: 980,
                    height: 600,
                    maxHeight: "92vh",
                    background: T.WHITE,
                    borderRadius: 14,
                    boxShadow: "0 20px 50px rgba(22,41,77,0.18)",
                }}
            >
                {/* Header */}
                <div
                    className="flex items-start justify-between gap-4"
                    style={{ padding: "20px 24px 16px" }}
                >
                    <div className="flex flex-col gap-1">
                        <span
                            style={{
                                fontSize: 19,
                                fontWeight: 700,
                                color: T.NAVY,
                            }}
                        >
                            {td("Filter tasks")}
                        </span>
                        <span style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                            {td("Narrow")} {tasks.length}{" "}
                            {td(
                                "tasks down to the list you want to work today.",
                            )}
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setDraft(EMPTY_DRAFT)}
                            style={{
                                padding: "8px 16px",
                                borderRadius: 8,
                                background: T.WHITE,
                                color: totalActive ? T.BLUE_DARK : T.TEXT_HINT,
                                border: `1px solid ${T.BORDER}`,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            {td("Reset")}
                        </button>
                        <button
                            type="button"
                            aria-label={td("Close")}
                            onClick={onClose}
                            style={{
                                display: "flex",
                                padding: 6,
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
                </div>

                {/* Views strip */}
                <div
                    className="flex flex-wrap items-center gap-3.5"
                    style={{
                        padding: "12px 24px",
                        background: T.SURFACE_2,
                        borderTop: `1px solid ${T.BORDER_SOFT}`,
                        borderBottom: `1px solid ${T.BORDER}`,
                    }}
                >
                    <span style={{ ...LABEL, color: T.TEXT_HINT }}>
                        {td("Views")}
                    </span>
                    {savedViews.map((view) => (
                        <span
                            key={view.id}
                            className="inline-flex items-center gap-2"
                            style={{
                                padding: "6px 12px",
                                borderRadius: 999,
                                border: `1px solid ${T.BORDER}`,
                                background: T.WHITE,
                                fontSize: 13,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    setDraft(
                                        draftFromFilters(
                                            view.filters as TaskFilterState,
                                        ),
                                    )
                                }
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 0,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: T.TEXT,
                                    cursor: "pointer",
                                }}
                            >
                                {view.name}
                            </button>
                            {view.visibility === "team" && (
                                <span
                                    style={{ fontSize: 12, color: T.TEXT_HINT }}
                                >
                                    · {td("team")}
                                </span>
                            )}
                            {view.is_owner && (
                                <button
                                    type="button"
                                    aria-label={td("Delete view")}
                                    onClick={() => onDeleteView(view.id)}
                                    style={{
                                        display: "flex",
                                        background: "transparent",
                                        border: "none",
                                        padding: 0,
                                        cursor: "pointer",
                                    }}
                                >
                                    <TaskGlyph
                                        d={TASK_ICON.x}
                                        size={11}
                                        color={T.TEXT_MUTED}
                                    />
                                </button>
                            )}
                        </span>
                    ))}
                    {showSaveForm ? (
                        <span className="inline-flex items-center gap-2">
                            <input
                                value={viewName}
                                autoFocus
                                onChange={(event) =>
                                    setViewName(event.target.value)
                                }
                                placeholder={td("Name this view")}
                                style={{
                                    padding: "6px 11px",
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: 8,
                                    fontSize: 13,
                                    minWidth: 160,
                                }}
                            />
                            <select
                                value={viewVisibility}
                                onChange={(event) =>
                                    setViewVisibility(
                                        event.target.value as
                                            | "private"
                                            | "team",
                                    )
                                }
                                style={{
                                    padding: "6px 11px",
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: 8,
                                    fontSize: 13,
                                }}
                            >
                                <option value="private">{td("Only me")}</option>
                                <option value="team">{td("Team")}</option>
                            </select>
                            <button
                                type="button"
                                disabled={!viewName.trim() || savingView}
                                onClick={() => {
                                    onSaveView(
                                        {
                                            name: viewName.trim(),
                                            visibility: viewVisibility,
                                            pinned: true,
                                        },
                                        draftToParams(draft),
                                    );
                                    setViewName("");
                                    setShowSaveForm(false);
                                }}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    background: T.BLUE,
                                    color: T.WHITE,
                                    border: "none",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    opacity:
                                        !viewName.trim() || savingView
                                            ? 0.6
                                            : 1,
                                }}
                            >
                                {savingView ? td("Saving…") : td("Save")}
                            </button>
                        </span>
                    ) : (
                        <span
                            className="inline-flex items-center gap-2.5"
                            style={{
                                padding: "6px 14px",
                                borderRadius: 999,
                                border: `1px dashed ${T.NAVY_MID}`,
                                fontSize: 13,
                                color: T.TEXT_MUTED,
                                fontStyle: "italic",
                            }}
                        >
                            {totalActive
                                ? td("Unsaved filter set")
                                : td("No filters yet")}
                            <button
                                type="button"
                                disabled={totalActive === 0}
                                onClick={() => setShowSaveForm(true)}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 0,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: T.BLUE,
                                    cursor: "pointer",
                                    fontStyle: "normal",
                                    opacity: totalActive === 0 ? 0.5 : 1,
                                }}
                            >
                                {td("Save")}
                            </button>
                        </span>
                    )}
                </div>

                {/* Body */}
                <div className="flex min-h-0 flex-1">
                    <div
                        className="flex flex-shrink-0 flex-col justify-between"
                        style={{
                            width: 224,
                            borderRight: `1px solid ${T.BORDER_SOFT}`,
                            padding: "16px 0",
                        }}
                    >
                        <div
                            className="flex flex-col gap-0.5"
                            style={{ padding: "0 12px" }}
                        >
                            {SECTIONS.map((item) => {
                                const active = section === item.key;
                                const count = sectionCounts[item.key];
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() =>
                                            scrollToSection(item.key)
                                        }
                                        className="tasks-record-row flex items-center gap-2.5"
                                        style={{
                                            padding: "9px 12px",
                                            borderRadius: 8,
                                            border: "none",
                                            fontSize: 14,
                                            fontWeight: active ? 600 : 500,
                                            color: active
                                                ? T.NAVY
                                                : T.TEXT_MUTED,
                                            background: active
                                                ? "#f2f4f7"
                                                : "transparent",
                                            cursor: "pointer",
                                            textAlign: "left",
                                        }}
                                    >
                                        <span className="flex-1">
                                            {td(item.label)}
                                        </span>
                                        {count > 0 && (
                                            <span
                                                className="inline-flex items-center justify-center"
                                                style={{
                                                    minWidth: 19,
                                                    height: 19,
                                                    padding: "0 5px",
                                                    borderRadius: 999,
                                                    background: T.BLUE_LIGHT,
                                                    color: T.BLUE_DARK,
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div
                            className="flex flex-col gap-1.5"
                            style={{
                                margin: "16px 12px 0",
                                padding: "16px 12px 4px",
                                borderTop: `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <span style={{ ...LABEL, color: T.TEXT_HINT }}>
                                {td("Current list")}
                            </span>
                            <span
                                style={{
                                    fontSize: 22,
                                    fontWeight: 700,
                                    color: T.NAVY,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {filteredCount}
                            </span>
                            <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                                {td("of")} {tasks.length} ·{" "}
                                {td("updates on Apply")}
                            </span>
                        </div>
                    </div>

                    <div
                        ref={scrollRef}
                        onScroll={onScroll}
                        className="min-w-0 flex-1 overflow-y-auto"
                        style={{ padding: "20px 26px 26px" }}
                    >
                        {sectionBlock(
                            "general",
                            "General",
                            <>
                                <div className="flex flex-col gap-2.5">
                                    {fieldHeader(
                                        "Priority",
                                        draft.priority.length,
                                    )}
                                    <div
                                        className="grid gap-2.5"
                                        style={{
                                            gridTemplateColumns:
                                                "repeat(3, 1fr)",
                                        }}
                                    >
                                        {TASK_PRIORITY_ORDER.map((key) => {
                                            const token = TASK_PRIORITY[key];
                                            const active =
                                                draft.priority.includes(key);
                                            const count = countFor(
                                                "priority",
                                                (vm) =>
                                                    vm.task.priority === key,
                                            );
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() =>
                                                        setDraft((current) => ({
                                                            ...current,
                                                            priority: toggle(
                                                                current.priority,
                                                                key,
                                                            ),
                                                        }))
                                                    }
                                                    className="flex flex-col gap-2 text-left"
                                                    style={{
                                                        padding: "13px 14px",
                                                        borderRadius: 10,
                                                        cursor: "pointer",
                                                        background: active
                                                            ? token.bg
                                                            : T.WHITE,
                                                        border: `1px solid ${active ? token.border : T.BORDER}`,
                                                        transition:
                                                            "background 120ms ease, border-color 120ms ease",
                                                    }}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <TaskGlyph
                                                            d={token.d}
                                                            size={15}
                                                            color={token.color}
                                                        />
                                                        <span
                                                            style={{
                                                                fontSize: 14,
                                                                fontWeight:
                                                                    active
                                                                        ? 700
                                                                        : 600,
                                                                color: active
                                                                    ? token.fg
                                                                    : T.TEXT,
                                                            }}
                                                        >
                                                            {td(token.label)}
                                                        </span>
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: 12,
                                                            color: active
                                                                ? token.fg
                                                                : T.TEXT_HINT,
                                                        }}
                                                    >
                                                        {count}{" "}
                                                        {count === 1
                                                            ? td("task")
                                                            : td("tasks")}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2.5">
                                    {fieldHeader(
                                        "Status",
                                        draft.status.length,
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                        {columns.map((column) => {
                                            const active = draft.status.includes(
                                                column.slug,
                                            );
                                            const token = statusToken(
                                                column.slug,
                                            );
                                            const count = countFor(
                                                "status",
                                                (vm) =>
                                                    vm.statusSlug ===
                                                    column.slug,
                                            );
                                            return (
                                                <button
                                                    key={column.id}
                                                    type="button"
                                                    style={chipStyle(active)}
                                                    onClick={() =>
                                                        setDraft((current) => ({
                                                            ...current,
                                                            status: toggle(
                                                                current.status,
                                                                column.slug,
                                                            ),
                                                        }))
                                                    }
                                                >
                                                    <span
                                                        style={{
                                                            width: 7,
                                                            height: 7,
                                                            borderRadius: 999,
                                                            background:
                                                                token.dot,
                                                        }}
                                                    />
                                                    {td(column.column_name, {
                                                        source: "en",
                                                    })}
                                                    <span
                                                        style={{
                                                            fontSize: 12,
                                                            color: active
                                                                ? T.BLUE_DARK
                                                                : T.TEXT_HINT,
                                                        }}
                                                    >
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>,
                            true,
                        )}

                        {sectionBlock(
                            "assignment",
                            "Assignment",
                            <>
                                <div className="flex flex-col gap-2.5">
                                    {fieldHeader(
                                        "Assigned to",
                                        draft.assignedTo.length,
                                    )}
                                    {agentList("assignedTo", (vm, userId) =>
                                        vm.people.some(
                                            (person) => person.id === userId,
                                        ),
                                    )}
                                </div>

                                <div className="flex flex-col gap-2.5">
                                    {fieldHeader(
                                        "Assigned by",
                                        draft.assignedBy.length,
                                    )}
                                    {agentList(
                                        "assignedBy",
                                        (vm, userId) =>
                                            vm.task.added_by === userId ||
                                            vm.task.created_by?.id === userId,
                                    )}
                                </div>
                            </>,
                        )}

                        {sectionBlock(
                            "category",
                            "Category",
                            <div className="flex flex-col gap-2.5">
                                {fieldHeader(
                                    "Task category",
                                    draft.categoryId.length,
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {categories.map((category) => {
                                        const active =
                                            draft.categoryId.includes(
                                                String(category.id),
                                            );
                                        const token = categoryToken(
                                            category.category_name,
                                        );
                                        const count = countFor(
                                            "categoryId",
                                            (vm) =>
                                                vm.task.category?.id ===
                                                category.id,
                                        );
                                        return (
                                            <button
                                                key={category.id}
                                                type="button"
                                                style={chipStyle(active)}
                                                onClick={() =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        categoryId: toggle(
                                                            current.categoryId,
                                                            String(category.id),
                                                        ),
                                                    }))
                                                }
                                            >
                                                <span
                                                    style={{
                                                        width: 7,
                                                        height: 7,
                                                        borderRadius: 2,
                                                        background: token.dot,
                                                    }}
                                                />
                                                {category.category_name}
                                                <span
                                                    style={{
                                                        fontSize: 12,
                                                        color: active
                                                            ? T.BLUE_DARK
                                                            : T.TEXT_HINT,
                                                    }}
                                                >
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {categories.length === 0 && (
                                        <span
                                            style={{
                                                fontSize: 13,
                                                color: T.TEXT_HINT,
                                            }}
                                        >
                                            {td("No categories defined yet.")}
                                        </span>
                                    )}
                                </div>
                            </div>,
                        )}

                        {sectionBlock(
                            "due",
                            "Due date",
                            <>
                                <div
                                    className="flex items-center justify-between gap-4"
                                    style={{
                                        padding: "11px 14px",
                                        border: `1px solid ${T.BORDER}`,
                                        borderRadius: 10,
                                    }}
                                >
                                    <span
                                        style={{ fontSize: 14, color: T.TEXT }}
                                    >
                                        {td("Due window")}
                                    </span>
                                    <div
                                        className="flex gap-0.5 p-0.5"
                                        style={{
                                            background: T.BG,
                                            border: `1px solid ${T.BORDER}`,
                                            borderRadius: 8,
                                        }}
                                    >
                                        {DUE_ITEMS.map((item) => {
                                            const active =
                                                draft.due === item.key;
                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    onClick={() =>
                                                        setDraft((current) => ({
                                                            ...current,
                                                            due: item.key,
                                                        }))
                                                    }
                                                    style={{
                                                        padding: "6px 12px",
                                                        borderRadius: 6,
                                                        border: "none",
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        cursor: "pointer",
                                                        background: active
                                                            ? T.NAVY
                                                            : "transparent",
                                                        color: active
                                                            ? T.WHITE
                                                            : T.TEXT_MUTED,
                                                    }}
                                                >
                                                    {td(item.label)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {draft.due === "custom" && (
                                    <div
                                        className="grid gap-3"
                                        style={{
                                            gridTemplateColumns: "1fr 1fr",
                                            padding: 14,
                                            background: T.SURFACE_2,
                                            border: `1px solid ${T.BORDER}`,
                                            borderRadius: 10,
                                        }}
                                    >
                                        <label className="flex flex-col gap-1.5">
                                            <span style={LABEL}>
                                                {td("Start date")}
                                            </span>
                                            <input
                                                type="date"
                                                value={draft.from}
                                                onChange={(event) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        from: event.target
                                                            .value,
                                                    }))
                                                }
                                                style={{
                                                    padding: "9px 11px",
                                                    border: `1px solid ${T.BORDER}`,
                                                    borderRadius: 8,
                                                    fontSize: 13,
                                                    background: T.WHITE,
                                                }}
                                            />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span style={LABEL}>
                                                {td("End date")}
                                            </span>
                                            <input
                                                type="date"
                                                value={draft.to}
                                                onChange={(event) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        to: event.target.value,
                                                    }))
                                                }
                                                style={{
                                                    padding: "9px 11px",
                                                    border: `1px solid ${T.BORDER}`,
                                                    borderRadius: 8,
                                                    fontSize: 13,
                                                    background: T.WHITE,
                                                }}
                                            />
                                        </label>
                                    </div>
                                )}
                            </>,
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="flex items-center gap-4"
                    style={{
                        padding: "14px 24px",
                        borderTop: `1px solid ${T.BORDER}`,
                        background: T.SURFACE_2,
                    }}
                >
                    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                        {tokens.map((token) => (
                            <span
                                key={token.label}
                                className="inline-flex items-center gap-2"
                                style={{
                                    padding: "5px 10px",
                                    borderRadius: 8,
                                    background: T.BLUE_LIGHT,
                                    color: T.BLUE_DARK,
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}
                            >
                                {token.label}
                                <button
                                    type="button"
                                    aria-label={`${td("Remove")} ${token.label}`}
                                    onClick={token.onRemove}
                                    style={{
                                        display: "flex",
                                        background: "transparent",
                                        border: "none",
                                        padding: 0,
                                        cursor: "pointer",
                                    }}
                                >
                                    <TaskGlyph
                                        d={TASK_ICON.x}
                                        size={12}
                                        color={T.BLUE_DARK}
                                    />
                                </button>
                            </span>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            onApply(draftToParams(draft));
                            onClose();
                        }}
                        style={{
                            flexShrink: 0,
                            padding: "9px 18px",
                            borderRadius: 8,
                            background: T.BLUE,
                            color: T.WHITE,
                            border: `1px solid ${T.BLUE}`,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {td("Apply filters")}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
