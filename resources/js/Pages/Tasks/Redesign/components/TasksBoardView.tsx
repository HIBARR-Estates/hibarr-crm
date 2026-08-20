import { useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { TASK_ICON, statusToken } from "../config/taskDesignTokens";
import type { TaskViewModel } from "../adapters/taskViewModel";
import { TaskGlyph, TaskPriorityInline } from "./primitives/TaskGlyphs";
import TaskRecordIcon from "./primitives/TaskRecordIcon";

interface TasksBoardViewProps {
    tasks: TaskViewModel[];
    columns: TaskboardColumn[];
    /** "full" shows the blurb + linked-record lines; "minimal" hides them. */
    cardMeta: "full" | "minimal";
    canMove: (vm: TaskViewModel) => boolean;
    onOpen: (vm: TaskViewModel) => void;
    onMove: (vm: TaskViewModel, column: TaskboardColumn) => void;
    /** Cards revealed per column before "Show more". */
    pageSize: number;
}

/**
 * Per-column empty-state copy. Keyed by column slug so each lane says
 * something encouraging rather than a flat "no tasks".
 */
const EMPTY_COPY: Record<string, { line: string; hint: string }> = {
    to_do: {
        line: "Nothing waiting here",
        hint: "A clean backlog is a rare and beautiful thing.",
    },
    incomplete: {
        line: "Nothing waiting here",
        hint: "A clean backlog is a rare and beautiful thing.",
    },
    in_progress: {
        line: "Nothing in flight",
        hint: "Drag something over when you're ready to start.",
    },
    waiting: {
        line: "Nobody's blocked",
        hint: "No one is waiting on anyone. Enjoy it.",
    },
    done: {
        line: "No wins logged yet",
        hint: "Finish something and watch this fill up.",
    },
};

const DEFAULT_EMPTY = {
    line: "This lane is clear",
    hint: "Drag a card here to move it.",
};

/** Every empty lane renders at this height, so the columns line up. */
const EMPTY_STATE_HEIGHT = 152;

/** Reveals the next page of a column's cards when its sentinel scrolls in. */
function useAutoReveal(
    enabled: boolean,
    onReveal: () => void,
): (node: HTMLDivElement | null) => void {
    const observerRef = useRef<IntersectionObserver | null>(null);
    const callbackRef = useRef(onReveal);
    callbackRef.current = onReveal;

    useEffect(
        () => () => {
            observerRef.current?.disconnect();
        },
        [],
    );

    return (node: HTMLDivElement | null) => {
        observerRef.current?.disconnect();
        if (!node || !enabled) return;
        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    callbackRef.current();
                }
            },
            { rootMargin: "120px" },
        );
        observerRef.current.observe(node);
    };
}

function ColumnSentinel({
    enabled,
    onReveal,
}: {
    enabled: boolean;
    onReveal: () => void;
}) {
    const ref = useAutoReveal(enabled, onReveal);
    if (!enabled) return null;
    return <div ref={ref} style={{ height: 1 }} aria-hidden="true" />;
}

/**
 * Board matching the handoff's card anatomy: assignee stack + label, title,
 * blurb, linked records, then a due/priority footer. Drag-and-drop uses the
 * native HTML5 API exactly as the template does, so a card can be dropped on
 * any column to change its status.
 */
export default function TasksBoardView({
    tasks,
    columns,
    cardMeta,
    canMove,
    onOpen,
    onMove,
    pageSize,
}: TasksBoardViewProps) {
    const { td } = useTd();
    const [dragId, setDragId] = useState<number | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
    /** Extra cards revealed per column beyond `pageSize`, keyed by column id. */
    const [revealed, setRevealed] = useState<Record<number, number>>({});

    const sortedColumns = [...columns].sort((a, b) => a.priority - b.priority);
    const full = cardMeta === "full";

    return (
        // Fills the height its parent allots and never grows past it — the
        // columns scroll internally, the page itself does not.
        <div className="flex h-full items-stretch gap-3.5 overflow-hidden">
            {sortedColumns.map((column) => {
                const token = statusToken(column.slug);
                const columnTasks = tasks.filter(
                    (vm) => vm.statusSlug === column.slug,
                );
                const shown = revealed[column.id] ?? pageSize;
                const visibleTasks = columnTasks.slice(0, shown);
                const hiddenCount = columnTasks.length - visibleTasks.length;
                const isTarget =
                    dragOverColumn === column.id && dragId !== null;
                const isEmpty = columnTasks.length === 0 && !isTarget;

                return (
                    <div
                        key={column.id}
                        onDragOver={(event) => {
                            event.preventDefault();
                            if (dragOverColumn !== column.id) {
                                setDragOverColumn(column.id);
                            }
                        }}
                        onDragLeave={() => {
                            if (dragOverColumn === column.id) {
                                setDragOverColumn(null);
                            }
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            const dropped = tasks.find(
                                (vm) => vm.id === dragId,
                            );
                            setDragId(null);
                            setDragOverColumn(null);
                            if (dropped && dropped.statusSlug !== column.slug) {
                                onMove(dropped, column);
                            }
                        }}
                        className="flex h-full min-w-0 flex-1 flex-col overflow-hidden"
                        style={{
                            background: isTarget ? "#f8fbff" : T.SURFACE,
                            border: `1px solid ${isTarget ? T.BLUE_MID : T.BORDER}`,
                            borderRadius: 10,
                            transition:
                                "background 120ms ease, border-color 120ms ease",
                        }}
                    >
                        <div
                            className="flex flex-shrink-0 items-center gap-2"
                            style={{
                                padding: "13px 14px",
                                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <span
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 999,
                                    background: token.dot,
                                }}
                            />
                            <span
                                className="flex-1"
                                style={{
                                    fontSize: 16,
                                    fontWeight: 600,
                                    color: T.NAVY,
                                }}
                            >
                                {td(column.column_name, { source: "en" })}
                            </span>
                            <span
                                style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: T.TEXT_MUTED,
                                    background: T.BG,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: 999,
                                    padding: "1px 8px",
                                }}
                            >
                                {columnTasks.length}
                            </span>
                        </div>

                        <div
                            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto"
                            style={{ padding: 12 }}
                        >
                            {visibleTasks.map((vm) => {
                                const draggable = canMove(vm);
                                const dragging = dragId === vm.id;
                                return (
                                    <div
                                        key={vm.id}
                                        draggable={draggable}
                                        onDragStart={(event) => {
                                            if (event.dataTransfer) {
                                                event.dataTransfer.effectAllowed =
                                                    "move";
                                            }
                                            setDragId(vm.id);
                                        }}
                                        onDragEnd={() => {
                                            setDragId(null);
                                            setDragOverColumn(null);
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onOpen(vm)}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" ||
                                                event.key === " "
                                            ) {
                                                event.preventDefault();
                                                onOpen(vm);
                                            }
                                        }}
                                        className="tasks-board-card flex min-w-0 flex-none flex-col gap-3"
                                        style={{
                                            overflow: "hidden",
                                            border: `1px solid ${T.BORDER}`,
                                            borderRadius: 10,
                                            background: T.SURFACE,
                                            padding: "15px 15px 14px",
                                            cursor: draggable
                                                ? "grab"
                                                : "pointer",
                                            minHeight: full ? 176 : 130,
                                            opacity: dragging ? 0.45 : 1,
                                            boxShadow: dragging
                                                ? "0 8px 20px rgba(22,41,77,0.14)"
                                                : "none",
                                        }}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex flex-shrink-0">
                                                {vm.people
                                                    .slice(0, 3)
                                                    .map((person, index) => (
                                                        <span
                                                            key={person.id}
                                                            title={person.name}
                                                            className="flex rounded-full"
                                                            style={{
                                                                marginRight:
                                                                    index ===
                                                                    Math.min(
                                                                        vm
                                                                            .people
                                                                            .length,
                                                                        3,
                                                                    ) -
                                                                        1
                                                                        ? 0
                                                                        : -7,
                                                                border: `2px solid ${T.WHITE}`,
                                                            }}
                                                        >
                                                            <Avatar
                                                                size={24}
                                                                initials={
                                                                    person.initials
                                                                }
                                                            />
                                                        </span>
                                                    ))}
                                            </div>
                                            <span
                                                className="min-w-0 flex-1 truncate"
                                                style={{
                                                    fontSize: 14,
                                                    color: T.TEXT_MUTED,
                                                    paddingLeft: 5,
                                                }}
                                            >
                                                {vm.people.length === 0
                                                    ? td("Unassigned")
                                                    : vm.peopleLabel}
                                            </span>
                                        </div>

                                        <span
                                            className="tasks-clamp-2"
                                            style={{
                                                fontSize: 16,
                                                fontWeight: 700,
                                                color: T.NAVY,
                                                lineHeight: 1.35,
                                                textDecoration:
                                                    vm.titleDecoration,
                                            }}
                                        >
                                            {vm.title}
                                        </span>

                                        {full && vm.blurb && (
                                            <span
                                                className="tasks-clamp-3 flex-1"
                                                style={{
                                                    fontSize: 15,
                                                    color: T.TEXT_MUTED,
                                                    lineHeight: 1.45,
                                                }}
                                            >
                                                {vm.blurb}
                                            </span>
                                        )}

                                        {full && (
                                            <div
                                                className="flex min-w-0 flex-col gap-1"
                                                style={{ marginTop: "auto" }}
                                            >
                                                {vm.links.map((link) => {
                                                    const body = (
                                                        <>
                                                            <TaskRecordIcon
                                                                type={link.type}
                                                                size={13}
                                                                color={
                                                                    link.iconFg
                                                                }
                                                            />
                                                            <span
                                                                className="truncate"
                                                                style={{
                                                                    fontSize: 14,
                                                                    color: T.TEXT_MUTED,
                                                                }}
                                                            >
                                                                {td(
                                                                    link.typeLabel,
                                                                )}{" "}
                                                                · {link.name}
                                                            </span>
                                                        </>
                                                    );
                                                    // Opens the record itself
                                                    // rather than the card's
                                                    // task modal.
                                                    return link.href ? (
                                                        <a
                                                            key={`${link.type}-${link.name}`}
                                                            href={link.href}
                                                            draggable={false}
                                                            onClick={(event) =>
                                                                event.stopPropagation()
                                                            }
                                                            className="tasks-entity-link flex min-w-0 items-center gap-1.5"
                                                        >
                                                            {body}
                                                        </a>
                                                    ) : (
                                                        <div
                                                            key={`${link.type}-${link.name}`}
                                                            className="flex min-w-0 items-center gap-1.5"
                                                        >
                                                            {body}
                                                        </div>
                                                    );
                                                })}
                                                {vm.extraLinks > 0 && (
                                                    <span
                                                        style={{
                                                            fontSize: 14,
                                                            fontWeight: 600,
                                                            color: T.BLUE,
                                                            paddingLeft: 20,
                                                        }}
                                                    >
                                                        +{vm.extraLinks}{" "}
                                                        {td("more linked")}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex min-w-0 items-center justify-between gap-2.5 pt-0.5">
                                            <span
                                                className="inline-flex min-w-0 items-center gap-1.5 truncate whitespace-nowrap"
                                                style={{
                                                    fontSize: 14,
                                                    color: vm.dueColor,
                                                }}
                                            >
                                                <TaskGlyph
                                                    d={TASK_ICON.calendar}
                                                    size={13}
                                                    strokeWidth={1.5}
                                                />
                                                {td(vm.dueText, {
                                                    source: "en",
                                                })}
                                            </span>
                                            <TaskPriorityInline
                                                priority={vm.priority}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Scrolling to the bottom of a column reveals the
                                next page automatically. */}
                            {hiddenCount > 0 && (
                                <>
                                    <ColumnSentinel
                                        enabled
                                        onReveal={() =>
                                            setRevealed((current) => ({
                                                ...current,
                                                [column.id]:
                                                    (current[column.id] ??
                                                        pageSize) + pageSize,
                                            }))
                                        }
                                    />
                                    <div
                                        className="flex items-center justify-center gap-2"
                                        style={{
                                            padding: "8px 12px",
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: T.TEXT_HINT,
                                        }}
                                    >
                                        <span
                                            className="tasks-pulse-bar"
                                            style={{
                                                width: 5,
                                                borderRadius: 999,
                                                background: T.BLUE_MID,
                                            }}
                                        />
                                        {td("Loading")} {hiddenCount}{" "}
                                        {td("more…")}
                                    </div>
                                </>
                            )}

                            {isTarget && (
                                <div
                                    className="flex items-center justify-center"
                                    style={{
                                        border: `1px dashed ${T.BLUE_MID}`,
                                        borderRadius: 10,
                                        background: "#f4f9ff",
                                        padding: 14,
                                        // In an otherwise empty lane the drop
                                        // hint stands in for the empty state,
                                        // so it takes the same height and the
                                        // column doesn't jump mid-drag.
                                        height:
                                            columnTasks.length === 0
                                                ? EMPTY_STATE_HEIGHT
                                                : undefined,
                                        flexShrink: 0,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: T.BLUE_DARK,
                                        textAlign: "center",
                                    }}
                                >
                                    {td("Drop to mark")}{" "}
                                    {td(column.column_name, { source: "en" })}
                                </div>
                            )}

                            {isEmpty && (
                                <div
                                    className="flex flex-col items-center justify-center gap-2"
                                    style={{
                                        // Fixed so every lane's empty state is
                                        // the same height regardless of how
                                        // long its copy wraps.
                                        height: EMPTY_STATE_HEIGHT,
                                        flexShrink: 0,
                                        padding: "16px 14px",
                                        border: `1px dashed ${T.BORDER}`,
                                        borderRadius: 10,
                                        background: "#fbfcfd",
                                    }}
                                >
                                    <TaskGlyph
                                        d={TASK_ICON.inboxEmpty}
                                        size={22}
                                        color={T.NAVY_MID}
                                        strokeWidth={1.5}
                                    />
                                    <span
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 600,
                                            color: T.TEXT_MUTED,
                                            textAlign: "center",
                                        }}
                                    >
                                        {td(
                                            (
                                                EMPTY_COPY[column.slug] ??
                                                DEFAULT_EMPTY
                                            ).line,
                                        )}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 14,
                                            color: T.TEXT_HINT,
                                            textAlign: "center",
                                            lineHeight: 1.45,
                                        }}
                                    >
                                        {td(
                                            (
                                                EMPTY_COPY[column.slug] ??
                                                DEFAULT_EMPTY
                                            ).hint,
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
