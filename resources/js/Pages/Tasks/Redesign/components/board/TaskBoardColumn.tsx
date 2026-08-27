import { useEffect, useRef } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { TASK_ICON, statusToken } from "../../config/taskDesignTokens";
import { BOARD_EMPTY_STATE_HEIGHT } from "../../config/boardEmptyCopy";
import type { TaskViewModel } from "../../adapters/taskViewModel";
import { TaskGlyph } from "../primitives/TaskGlyphs";
import type { TaskRowAction } from "../primitives/TaskRowMenu";
import TaskBoardCard from "./TaskBoardCard";
import TaskBoardEmptyState from "./TaskBoardEmptyState";

/** Reveals the next page of a column's cards when its sentinel scrolls in. */
function useAutoReveal(
    enabled: boolean,
    onReveal: () => void,
): (node: HTMLDivElement | null) => void {
    const observerRef = useRef<IntersectionObserver | null>(null);
    const callbackRef = useRef(onReveal);

    useEffect(() => {
        callbackRef.current = onReveal;
    }, [onReveal]);

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

export interface TaskBoardColumnProps {
    column: TaskboardColumn;
    /** Every task already assigned to this column (reveal-paging happens here). */
    tasks: TaskViewModel[];
    cardMeta: "full" | "minimal";
    pageSize: number;
    revealedCount: number;
    onRevealMore: () => void;
    canMove: (vm: TaskViewModel) => boolean;
    onOpen: (vm: TaskViewModel) => void;
    rowActions: (vm: TaskViewModel) => TaskRowAction[];
    draggingId: number | null;
    isDragTarget: boolean;
    onCardDragStart: (vm: TaskViewModel) => void;
    onCardDragEnd: () => void;
    onColumnDragOver: () => void;
    onColumnDragLeave: () => void;
    onColumnDrop: () => void;
    /** Column-header "+" — quick-add a task pre-filed into this column. Hidden when omitted. */
    onAddToColumn?: (column: TaskboardColumn) => void;
}

/** One Kanban lane: header (dot, name, count, quick-add) + its cards. */
export default function TaskBoardColumn({
    column,
    tasks,
    cardMeta,
    pageSize,
    revealedCount,
    onRevealMore,
    canMove,
    onOpen,
    rowActions,
    draggingId,
    isDragTarget,
    onCardDragStart,
    onCardDragEnd,
    onColumnDragOver,
    onColumnDragLeave,
    onColumnDrop,
    onAddToColumn,
}: TaskBoardColumnProps) {
    const { td } = useTd();
    const token = statusToken(column.slug);
    const shown = revealedCount || pageSize;
    const visibleTasks = tasks.slice(0, shown);
    const hiddenCount = tasks.length - visibleTasks.length;
    const isEmpty = tasks.length === 0 && !isDragTarget;

    return (
        <div
            onDragOver={(event) => {
                event.preventDefault();
                onColumnDragOver();
            }}
            onDragLeave={onColumnDragLeave}
            onDrop={(event) => {
                event.preventDefault();
                onColumnDrop();
            }}
            className="flex min-w-0 flex-1 flex-col self-start"
            style={{
                background: isDragTarget ? "#f8fbff" : T.SURFACE,
                border: `1px solid ${isDragTarget ? T.BLUE_MID : T.BORDER}`,
                borderRadius: 10,
                transition: "background 120ms ease, border-color 120ms ease",
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
                    style={{ fontSize: 16, fontWeight: 600, color: T.NAVY }}
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
                    {tasks.length}
                </span>
                {onAddToColumn && (
                    <button
                        type="button"
                        aria-label={`${td("Add task")} · ${td(column.column_name, { source: "en" })}`}
                        title={td("Add task")}
                        onClick={() => onAddToColumn(column)}
                        className="flex flex-shrink-0 items-center justify-center"
                        style={{
                            width: 22,
                            height: 22,
                            padding: 0,
                            borderRadius: 6,
                            border: `1px solid ${T.BORDER}`,
                            background: T.WHITE,
                            color: T.TEXT_MUTED,
                            cursor: "pointer",
                        }}
                    >
                        <TaskGlyph d={TASK_ICON.plus} size={13} strokeWidth={1.5} />
                    </button>
                )}
            </div>

            <div
                className="flex flex-col gap-2.5 overflow-y-auto"
                style={{
                    padding: 12,
                    maxHeight:
                        "calc(104.5vh - var(--tasks-board-offset) - var(--tasks-board-column-header))",
                }}
            >
                {visibleTasks.map((vm) => (
                    <TaskBoardCard
                        key={vm.id}
                        vm={vm}
                        cardMeta={cardMeta}
                        draggable={canMove(vm)}
                        dragging={draggingId === vm.id}
                        onOpen={() => onOpen(vm)}
                        onDragStart={(event) => {
                            if (event.dataTransfer) {
                                event.dataTransfer.effectAllowed = "move";
                            }
                            onCardDragStart(vm);
                        }}
                        onDragEnd={onCardDragEnd}
                        actions={rowActions(vm)}
                    />
                ))}

                {/* Scrolling to the bottom of a column reveals the next
                    page automatically. */}
                {hiddenCount > 0 && (
                    <>
                        <ColumnSentinel enabled onReveal={onRevealMore} />
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
                            {td("Loading")} {hiddenCount} {td("more…")}
                        </div>
                    </>
                )}

                {isDragTarget && (
                    <div
                        className="flex items-center justify-center"
                        style={{
                            border: `1px dashed ${T.BLUE_MID}`,
                            borderRadius: 10,
                            background: "#f4f9ff",
                            padding: 14,
                            // In an otherwise empty lane the drop hint
                            // stands in for the empty state, so it takes
                            // the same height and the column doesn't jump
                            // mid-drag.
                            height:
                                tasks.length === 0
                                    ? BOARD_EMPTY_STATE_HEIGHT
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

                {isEmpty && <TaskBoardEmptyState slug={column.slug} />}
            </div>
        </div>
    );
}
