import { useState } from "react";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { TaskViewModel } from "../adapters/taskViewModel";
import type { TaskRowAction } from "./primitives/TaskRowMenu";
import TaskBoardColumn from "./board/TaskBoardColumn";

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
    /** Row menu ("…") actions — same set the list view uses per task. */
    rowActions: (vm: TaskViewModel) => TaskRowAction[];
    /** Column-header "+" — quick-add pre-filled into that column. Hidden when omitted. */
    onAddToColumn?: (column: TaskboardColumn) => void;
}

/**
 * Board matching the handoff's card anatomy: assignee + row menu, title,
 * blurb, linked records, then a due/priority footer. Drag-and-drop uses the
 * native HTML5 API exactly as the template does, so a card can be dropped on
 * any column to change its status. Owns only the cross-column drag/reveal
 * state; the lane and card themselves live in ./board.
 */
export default function TasksBoardView({
    tasks,
    columns,
    cardMeta,
    canMove,
    onOpen,
    onMove,
    pageSize,
    rowActions,
    onAddToColumn,
}: TasksBoardViewProps) {
    const [dragId, setDragId] = useState<number | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
    /** Extra cards revealed per column beyond `pageSize`, keyed by column id. */
    const [revealed, setRevealed] = useState<Record<number, number>>({});

    const sortedColumns = [...columns].sort((a, b) => a.priority - b.priority);

    return (
        // Columns are content-height by default; each caps and scrolls
        // internally only once its cards exceed the viewport allowance.
        <div className="flex items-start gap-3.5">
            {sortedColumns.map((column) => {
                const columnTasks = tasks.filter(
                    (vm) => vm.statusSlug === column.slug,
                );

                return (
                    <TaskBoardColumn
                        key={column.id}
                        column={column}
                        tasks={columnTasks}
                        cardMeta={cardMeta}
                        pageSize={pageSize}
                        revealedCount={revealed[column.id] ?? pageSize}
                        onRevealMore={() =>
                            setRevealed((current) => ({
                                ...current,
                                [column.id]:
                                    (current[column.id] ?? pageSize) +
                                    pageSize,
                            }))
                        }
                        canMove={canMove}
                        onOpen={onOpen}
                        rowActions={rowActions}
                        draggingId={dragId}
                        isDragTarget={
                            dragOverColumn === column.id && dragId !== null
                        }
                        onCardDragStart={(vm) => setDragId(vm.id)}
                        onCardDragEnd={() => {
                            setDragId(null);
                            setDragOverColumn(null);
                        }}
                        onColumnDragOver={() => {
                            if (dragOverColumn !== column.id) {
                                setDragOverColumn(column.id);
                            }
                        }}
                        onColumnDragLeave={() => {
                            if (dragOverColumn === column.id) {
                                setDragOverColumn(null);
                            }
                        }}
                        onColumnDrop={() => {
                            const dropped = tasks.find(
                                (vm) => vm.id === dragId,
                            );
                            setDragId(null);
                            setDragOverColumn(null);
                            if (dropped && dropped.statusSlug !== column.slug) {
                                onMove(dropped, column);
                            }
                        }}
                        onAddToColumn={onAddToColumn}
                    />
                );
            })}
        </div>
    );
}
