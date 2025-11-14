import React, { useState, useCallback } from "react";
import { Deal, PipelineStage } from "@/Types/api/deals";
import KanbanColumn from "./KanbanColumn";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DealCard from "./DealCard";

interface BoardColumn extends PipelineStage {
    deals: Deal[];
    deals_count: number;
    total_value: number;
    default?: boolean;
    slug?: string;
    userSetting?: {
        collapsed: boolean;
    };
}

interface KanbanBoardProps {
    columns: BoardColumn[];
    addLeadPermission: string;
    onCreateDeal: (columnId?: number) => void;
    onEditDeal: (deal: Deal) => void;
    onEditColumn: (columnId: number) => void;
    onDeleteColumn: (columnId: number) => void;
    onLoadMore?: (columnId: number) => void;
    onColumnsUpdate?: (columns: BoardColumn[]) => void;
    draggingEnabled?: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
    columns: initialColumns,
    addLeadPermission,
    onCreateDeal,
    onEditDeal,
    onEditColumn,
    onDeleteColumn,
    onLoadMore,
    onColumnsUpdate,
    draggingEnabled = false,
}) => {
    const [columns, setColumns] = useState<BoardColumn[]>(initialColumns);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

    // Update local state when props change
    React.useEffect(() => {
        setColumns(initialColumns);
    }, [initialColumns]);

    // API Mutations
    const { mutate: updateDealPosition } = useApiMutate(
        route("leadboards.update_index"),
        "POST"
    );

    const { mutate: toggleColumnCollapse } = useApiMutate(
        route("leadboards.collapse_column"),
        "POST"
    );

    // Drag and drop sensors - conditionally enabled
    const sensors = useSensors(
        ...(draggingEnabled
            ? [
                  useSensor(PointerSensor, {
                      activationConstraint: {
                          distance: 3, // 3px movement required to start drag
                      },
                  }),
                  useSensor(KeyboardSensor, {
                      coordinateGetter: sortableKeyboardCoordinates,
                  }),
              ]
            : [])
    );

    const handleCollapse = useCallback(
        (columnId: number, type: "minimize" | "maximize") => {
            // Optimistic update
            setColumns((prev) =>
                prev.map((col) => {
                    if (col.id === columnId) {
                        return {
                            ...col,
                            userSetting: {
                                ...col.userSetting,
                                collapsed: type === "minimize",
                            },
                        };
                    }
                    return col;
                })
            );

            // API call
            toggleColumnCollapse(
                {
                    boardColumnId: columnId,
                    type: type,
                },
                {
                    onError: () => {
                        // Revert on error
                        setColumns((prev) =>
                            prev.map((col) => {
                                if (col.id === columnId) {
                                    return {
                                        ...col,
                                        userSetting: {
                                            ...col.userSetting,
                                            collapsed: type !== "minimize",
                                        },
                                    };
                                }
                                return col;
                            })
                        );
                    },
                }
            );
        },
        [toggleColumnCollapse]
    );

    // Find the deal and column by ID
    const findDealAndColumn = (dealId: string) => {
        for (const column of columns) {
            const deal = column.deals.find((d) => d.id.toString() === dealId);
            if (deal) {
                return { deal, column };
            }
        }
        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        if (!draggingEnabled) return;

        const { active } = event;
        const dealId = active.id as string;

        setActiveId(dealId);

        const result = findDealAndColumn(dealId);
        if (result) {
            setActiveDeal(result.deal);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        if (!draggingEnabled) return;

        const { active, over } = event;
        if (!over) return;

        const dealId = active.id as string;
        const overId = over.id as string;

        // Check if we're dragging over a column
        const overColumn = columns.find((col) => col.id.toString() === overId);
        if (overColumn) {
            // Move deal to the end of this column
            const result = findDealAndColumn(dealId);
            if (result && result.column.id !== overColumn.id) {
                setColumns((prev) => {
                    const newColumns = [...prev];

                    // Remove from source column
                    const sourceColumnIndex = newColumns.findIndex(
                        (col) => col.id === result.column.id
                    );
                    const sourceColumn = { ...newColumns[sourceColumnIndex] };
                    sourceColumn.deals = sourceColumn.deals.filter(
                        (d) => d.id.toString() !== dealId
                    );
                    sourceColumn.deals_count = Math.max(
                        0,
                        sourceColumn.deals_count - 1
                    );
                    sourceColumn.total_value = sourceColumn.deals.reduce(
                        (sum, d) => sum + (d.value || 0),
                        0
                    );
                    newColumns[sourceColumnIndex] = sourceColumn;

                    // Add to target column
                    const targetColumnIndex = newColumns.findIndex(
                        (col) => col.id === overColumn.id
                    );
                    const targetColumn = { ...newColumns[targetColumnIndex] };
                    targetColumn.deals = [...targetColumn.deals, result.deal];
                    targetColumn.deals_count = targetColumn.deals_count + 1;
                    targetColumn.total_value = targetColumn.deals.reduce(
                        (sum, d) => sum + (d.value || 0),
                        0
                    );
                    newColumns[targetColumnIndex] = targetColumn;

                    return newColumns;
                });
            }
        } else {
            // We might be dragging over another deal - handle reordering within same column
            const result = findDealAndColumn(dealId);
            const overResult = findDealAndColumn(overId);

            if (
                result &&
                overResult &&
                result.column.id === overResult.column.id
            ) {
                // Reorder within the same column
                setColumns((prev) => {
                    const newColumns = [...prev];
                    const columnIndex = newColumns.findIndex(
                        (col) => col.id === result.column.id
                    );
                    const column = { ...newColumns[columnIndex] };

                    const oldIndex = column.deals.findIndex(
                        (d) => d.id.toString() === dealId
                    );
                    const newIndex = column.deals.findIndex(
                        (d) => d.id.toString() === overId
                    );

                    column.deals = arrayMove(column.deals, oldIndex, newIndex);
                    newColumns[columnIndex] = column;

                    return newColumns;
                });
            }
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        setActiveId(null);
        setActiveDeal(null);

        if (!draggingEnabled || !over) return;

        const dealId = active.id as string;
        const result = findDealAndColumn(dealId);

        if (!result) return;

        // Find which column the deal ended up in
        const currentResult = findDealAndColumn(dealId);
        if (!currentResult) return;

        const { deal, column: targetColumn } = currentResult;

        // Prepare data for API call
        const taskIds = targetColumn.deals.map((d) => d.id);
        const priorities = targetColumn.deals.map((_, index) => index);

        // API call to update positions
        updateDealPosition(
            {
                boardColumnId: targetColumn.id,
                movingTaskId: deal.id,
                taskIds: taskIds,
                prioritys: priorities,
            },
            {
                onError: () => {
                    // Optionally handle error (e.g., revert UI changes)
                },
            }
        );

        // Notify parent component of changes
        if (onColumnsUpdate) {
            onColumnsUpdate(columns);
        }
    };

    // Get all deal IDs for sortable context
    const allDealIds = columns.flatMap((column) =>
        column.deals.map((deal) => deal.id.toString())
    );

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex overflow-x-auto pb-4" id="taskboard-columns">
                <SortableContext
                    items={allDealIds}
                    strategy={verticalListSortingStrategy}
                >
                    {columns.map((column) => (
                        <KanbanColumn
                            key={column.id}
                            column={column}
                            onCollapse={handleCollapse}
                            onEditColumn={onEditColumn}
                            onDeleteColumn={onDeleteColumn}
                            onCreateDeal={onCreateDeal}
                            onEditDeal={onEditDeal}
                            onLoadMore={onLoadMore}
                            addLeadPermission={addLeadPermission}
                            draggingEnabled={draggingEnabled}
                            canDelete={
                                !column.default &&
                                column.slug !== "generated" &&
                                column.slug !== "win" &&
                                column.slug !== "lost"
                            }
                        />
                    ))}
                </SortableContext>
            </div>

            <DragOverlay>
                {activeId && activeDeal ? (
                    <DealCard
                        deal={activeDeal}
                        draggable={false}
                        onEdit={onEditDeal}
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default KanbanBoard;
