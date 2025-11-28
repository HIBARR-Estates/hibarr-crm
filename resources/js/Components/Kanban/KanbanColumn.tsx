import React from "react";
import { Deal, PipelineStage } from "@/Types/api/deals";
import { Button, Dropdown, MenuProps } from "antd";
import {
    PlusOutlined,
    MoreOutlined,
    EditOutlined,
    DeleteOutlined,
    MinusOutlined,
    ExpandAltOutlined,
} from "@ant-design/icons";
import DealCard from "./DealCard";
import { Link } from "@inertiajs/react";
import { useDroppable } from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

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

interface KanbanColumnProps {
    column: BoardColumn;
    onCollapse: (columnId: number, type: "minimize" | "maximize") => void;
    onEditColumn: (columnId: number) => void;
    onDeleteColumn: (columnId: number) => void;
    onCreateDeal: (columnId?: number) => void;
    onEditDeal: (deal: Deal) => void;
    onLoadMore?: (columnId: number) => void;
    addLeadPermission: string;
    canDelete?: boolean;
    draggingEnabled?: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
    column,
    onCollapse,
    onEditColumn,
    onDeleteColumn,
    onCreateDeal,
    onEditDeal,
    onLoadMore,
    addLeadPermission,
    canDelete = true,
    draggingEnabled = true,
}) => {
    const isCollapsed = column.userSetting?.collapsed || false;

    // Set up droppable for the column
    const { setNodeRef, isOver } = useDroppable({
        id: column.id.toString(),
    });

    const formatCurrency = (amount: number) => {
        return `$${amount.toLocaleString()}`;
    };

    const dropdownItems: MenuProps["items"] = [
        ...(addLeadPermission !== "none"
            ? [
                  {
                      key: "add-deal",
                      label: (
                          <span onClick={() => onCreateDeal(column.id)}>
                              <PlusOutlined className="mr-2" />
                              Add Deal
                          </span>
                      ),
                  },
                  {
                      type: "divider" as const,
                  },
              ]
            : []),
        // TODO: This should be added later when permissions are handled properly .....
        // {
        //     key: "edit",
        //     label: (
        //         <span onClick={() => onEditColumn(column.id)}>
        //             <EditOutlined className="mr-2" />
        //             Edit
        //         </span>
        //     ),
        // },
        // ...(canDelete
        //     ? [
        //           {
        //               key: "delete",
        //               label: (
        //                   <span
        //                       onClick={() => onDeleteColumn(column.id)}
        //                       className="text-red-600"
        //                   >
        //                       <DeleteOutlined className="mr-2" />
        //                       Delete
        //                   </span>
        //               ),
        //           },
        //       ]
        //     : []),
    ];

    if (isCollapsed) {
        return (
            <div className="bg-gray-50 rounded-xl mr-3 w-16">
                <div className="flex flex-col items-center mt-4 mx-1 p-2">
                    {/* <Button
                        type="text"
                        size="small"
                        icon={<ExpandAltOutlined />}
                        onClick={() => onCollapse(column.id, "maximize")}
                        className="mb-3"
                        title="Expand"
                    /> */}

                    <div className="flex items-center mb-3">
                        <div
                            className="w-3 h-3 rounded-sm mr-2"
                            style={{ backgroundColor: column.label_color }}
                        />
                        <p className="text-sm font-medium text-gray-700 writing-mode-vertical-lr transform rotate-180">
                            {column.name}
                        </p>
                    </div>

                    <span className="bg-gray-200 text-xs px-2 py-1 rounded font-medium">
                        {column.deals_count}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 rounded-xl mr-3 w-80 flex-shrink-0 flex flex-col max-h-full">
            {/* Column Header */}
            <div className="mx-3 mt-3 mb-1 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <div
                            className="w-3 h-3 rounded-sm mr-2"
                            style={{ backgroundColor: column.label_color }}
                        />
                        <p className="text-sm font-normal text-gray-600 truncate">
                            {column.name}
                        </p>
                        <span className="bg-gray-200 text-xs px-2 py-1 rounded font-medium ml-2">
                            {column.deals_count}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* <Button
                            type="text"
                            size="small"
                            icon={<MinusOutlined />}
                            onClick={() => onCollapse(column.id, "minimize")}
                            title="Collapse"
                        /> */}

                        {addLeadPermission !== "none" && (
                            <Dropdown
                                menu={{ items: dropdownItems }}
                                trigger={["click"]}
                                placement="bottomRight"
                            >
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<MoreOutlined />}
                                />
                            </Dropdown>
                        )}
                    </div>
                </div>

                <div className="my-1 text-xl font-semibold text-gray-900">
                    {formatCurrency(column.total_value)}
                </div>
            </div>

            {/* Column Body */}
            <div className="pb-3 overflow-y-auto min-h-0">
                {/* Deals Container */}
                <div
                    ref={setNodeRef}
                    className={`min-h-32 ${
                        isOver
                            ? "bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg"
                            : ""
                    }`}
                    id={`drag-container-${column.id}`}
                    data-column-id={column.id}
                >
                    <SortableContext
                        items={column.deals.map((deal) => deal.id.toString())}
                        strategy={verticalListSortingStrategy}
                    >
                        {/* Empty State */}
                        {column.deals.length === 0 && (
                            <div className="bg-white rounded border-gray-200 border m-1 mx-3 mb-3 move-disable">
                                <div className="p-4 text-center">
                                    <p className="mb-0">
                                        <Button
                                            type="link"
                                            icon={<PlusOutlined />}
                                            onClick={() =>
                                                onCreateDeal(column.id)
                                            }
                                            className="text-gray-600 p-0 h-auto"
                                        >
                                            Add Deal
                                        </Button>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Deal Cards */}
                        {column.deals.map((deal) => (
                            <DealCard
                                key={deal.id}
                                deal={deal}
                                draggable={draggingEnabled}
                                onEdit={onEditDeal}
                            />
                        ))}
                    </SortableContext>
                </div>

                {/* Load More */}
                {column.deals_count > column.deals.length && onLoadMore && (
                    <div className="flex justify-center m-3">
                        <Button
                            type="link"
                            onClick={() => onLoadMore(column.id)}
                            className="text-sm text-gray-600"
                        >
                            Load More
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KanbanColumn;
