import React, { useState, useEffect } from "react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Button, Select, DatePicker } from "antd";
import { PlusOutlined, FilterOutlined } from "@ant-design/icons";
import { Link, router } from "@inertiajs/react";
import KanbanBoard from "@/Components/Kanban/KanbanBoard";
import { Deal, PipelineStage, Product } from "@/Types/api/deals";
import { LeadCategory, LeadSource } from "@/Types/api/leads";
import { User } from "@/Types";
import usePageFilter from "@/Hooks/usePageFilter";
import ActiveFilters from "@/Components/ActiveFilters";
import dayjs, { Dayjs } from "dayjs";
import SaveDealModal from "@/Features/Deals/SaveDeal/SaveDealModal";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import DealsModeSwitcher from "@/Components/Kanban/DealsModeSwitcher";
import FilterDrawer from "@/Components/FilterDrawer";
import AdvancedDealFilterForm from "@/Features/Deals/Filter/AdvancedDealFilterForm";
import BasicDealFilterBox from "@/Features/Deals/Filter/BasicDealFilterBox";
import DeleteColumn from "./Components/DeleteColumn";
import EditColumn from "./Components/EditColumn";

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

interface LeadBoardResult {
    boardColumns: BoardColumn[];
}

interface LeadAgent {
    id: number;
    user_id?: number;
    name: string;
    image?: string;
    user?: Pick<User, "id" | "name" | "email" | "image_url">;
}

interface Pipeline {
    id: number;
    name: string;
    default: number;
}

export interface LeadBoardIndexProps extends PageProps {
    pageTitle: string;
    result: LeadBoardResult;
    categories: LeadCategory[];
    sources: LeadSource[];
    stages: PipelineStage[];
    pipelines: Pipeline[];
    leadAgents: LeadAgent[];
    dealWatcher: User[];
    dealLeads: Array<{ id: number; client_name: string }>;
    products: Product[];
    currentPipelineName: string;
    addLeadPermission: string;
    viewLeadPermission: string;
    defaultPipeline: Pipeline;
    startDate: string;
    endDate: string;
}

const { RangePicker } = DatePicker;
const { Option } = Select;

const LeadBoardIndex = ({
    pageTitle,
    result: initialResult,
    categories,
    pipelines,
    leadAgents,
    dealWatcher,
    products,
    currentPipelineName,
    addLeadPermission,
    viewLeadPermission,
    defaultPipeline,
    startDate,
    endDate,
}: LeadBoardIndexProps) => {
    const [result, setResult] = useState(initialResult);

    // Update result when props change (from Inertia navigation)
    useEffect(() => {
        setResult(initialResult);
    }, [initialResult]);

    const handleColumnsUpdate = (updatedColumns: BoardColumn[]) => {
        setResult((prev) => ({
            ...prev,
            boardColumns: updatedColumns,
        }));
    };
    const {
        filters = {},
        drawerOpen,
        openFilterDrawer,
        closeFilterDrawer,
        handleQuickFilter,
        removeFilter,
        handleResetQuickFilters,
        handleResetFilters,
        handleFilterSubmit,
        clearAllFilters,
    } = usePageFilter({ routeName: "leadboards.index" });

    const {
        action,
        handleAction,
        handleClose,
        selected: deal,
    } = useGenericEntityAction<Deal>();

    // Column action state management
    const {
        action: columnAction,
        handleAction: handleColumnAction,
        handleClose: handleColumnClose,
        selected: selectedColumn,
    } = useGenericEntityAction<PipelineStage>();

    const handleCreateDeal = () => {
        handleAction("add");
    };

    const handleEditDeal = (deal: Deal) => {
        handleAction("edit", deal);
    };

    const handleEditColumn = (columnId: number) => {
        // Find the column in the result data
        const column = result.boardColumns.find((col) => col.id === columnId);
        if (column) {
            handleColumnAction("edit", column);
        }
    };

    const handleDeleteColumn = (columnId: number) => {
        // Find the column in the result data
        const column = result.boardColumns.find((col) => col.id === columnId);
        if (column) {
            handleColumnAction("delete", column);
        }
    };

    return (
        <>
            <SaveDealModal
                open={["add", "edit"].includes(action || "")}
                deal={deal}
                onClose={() => handleClose()}
            />
            <DashboardLayout>
                <div className="bg-gray-50 min-h-screen">
                    <PageLayout
                        title={pageTitle}
                        breadcrumbs={[{ name: "Lead Boards" }]}
                        filterSection={
                            <>
                                <BasicDealFilterBox
                                    filters={filters}
                                    handleResetFilters={handleResetFilters}
                                    handleQuickFilter={handleQuickFilter}
                                    handleResetQuickFilters={
                                        handleResetQuickFilters
                                    }
                                    handleSubmit={handleFilterSubmit}
                                />
                                {/* Active Filters */}
                                <ActiveFilters
                                    filters={filters}
                                    onRemoveFilter={removeFilter}
                                    onClearAll={clearAllFilters}
                                />
                            </>
                        }
                    >
                        <div className="bg-white rounded-lg shadow-sm">
                            {/* Header Actions */}
                            <div className="p-4 border-b border-gray-200">
                                {/* Mobile Warning */}
                                {/* <Alert
                            message="Drag and drop functionality works best on desktop devices"
                            type="info"
                            showIcon
                            className="mb-4 lg:hidden"
                        /> */}

                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <h1 className="text-xl font-semibold text-gray-900">
                                            {currentPipelineName}
                                        </h1>

                                        {(addLeadPermission === "all" ||
                                            addLeadPermission === "added") && (
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={() =>
                                                    handleCreateDeal()
                                                }
                                            >
                                                Add Deal
                                            </Button>
                                        )}

                                        {/* <Button
                                            icon={<PlusOutlined />}
                                            onClick={handleCreateStage}
                                        >
                                            Add Stages
                                        </Button> */}
                                    </div>

                                    <div className="flex items-center gap-x-2">
                                        <Button
                                            icon={<FilterOutlined />}
                                            onClick={openFilterDrawer}
                                        >
                                            Filters
                                        </Button>
                                        <DealsModeSwitcher />
                                    </div>
                                </div>
                            </div>

                            {/* Kanban Board */}
                            <div className="p-4">
                                <KanbanBoard
                                    columns={result.boardColumns}
                                    addLeadPermission={addLeadPermission}
                                    onCreateDeal={handleCreateDeal}
                                    onEditDeal={handleEditDeal}
                                    onEditColumn={handleEditColumn}
                                    onDeleteColumn={handleDeleteColumn}
                                    onColumnsUpdate={handleColumnsUpdate}
                                />
                            </div>
                        </div>
                    </PageLayout>
                </div>
                {/* Filter Drawer */}
                <FilterDrawer
                    open={drawerOpen}
                    onClose={closeFilterDrawer}
                    title="Deal Filters"
                    filters={filters}
                    onApplyFilters={handleFilterSubmit}
                    onResetFilters={handleResetFilters}
                >
                    <AdvancedDealFilterForm
                        filters={filters}
                        onFilterChange={handleQuickFilter}
                    />
                </FilterDrawer>

                {/* Column Management Modals */}
                <EditColumn
                    open={columnAction === "edit"}
                    stage={selectedColumn}
                    onClose={() => handleColumnClose()}
                />

                <DeleteColumn
                    open={columnAction === "delete"}
                    stage={selectedColumn}
                    onClose={() => handleColumnClose()}
                />
            </DashboardLayout>
        </>
    );
};

export default LeadBoardIndex;
