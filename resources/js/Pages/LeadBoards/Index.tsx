import React, { useMemo } from "react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import { Button, Select, DatePicker } from "antd";
import { PlusOutlined, FilterOutlined } from "@ant-design/icons";
import { router } from "@inertiajs/react";
import KanbanBoard from "@/Components/Kanban/KanbanBoard";
import { Deal, PipelineStage, Product } from "@/Types/api/deals";
import { LeadCategory, LeadSource } from "@/Types/api/leads";
import { User } from "@/Types";
import DealInformationGatheringForm from "@/Features/Deals/DealInformationGathering/DealInformationGatheringForm";
import SaveDealModal from "@/Features/Deals/SaveDeal/SaveDealModal";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import DealsModeSwitcher from "@/Components/Kanban/DealsModeSwitcher";
import DeleteColumn from "./Components/DeleteColumn";
import EditColumn from "./Components/EditColumn";
import ContextualActiveFilters from "@/Components/ContextualActiveFilters";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { createDealFilterConfig } from "@/configs/dealFilterConfig";
import PipelineSelector from "@/Features/Deals/PipelineSelector";

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
    allPipelines: Pipeline[];
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
    allPipelines: pipelines,
    leadAgents,
    dealWatcher,
    products,
    currentPipelineName,
    addLeadPermission,
    viewLeadPermission,
    defaultPipeline,
    startDate,
    endDate,
    ...props
}: LeadBoardIndexProps) => {
    // Removed local state for result to rely on props directly
    // const [result, setResult] = useState(initialResult);

    // Update result when props change (from Inertia navigation)
    // useEffect(() => {
    //     setResult(initialResult);
    // }, [initialResult]);

    const handleColumnsUpdate = (updatedColumns: BoardColumn[]) => {
        // Empty as requested
    };

    const { t } = useTranslation();

    // Memoize configs to prevent unnecessary re-renders and filter resets
    const filterConfig = useMemo(
        () => ({
            ...createDealFilterConfig({
                ...props,
                categories,
                leadPipelines: pipelines,
                stages: props.stages,
                leadAgents,
                excludeFields: [
                    "pipeline_stage_id",
                    "lead_pipeline_id",
                    "search",
                ],
            }),
            routeName: "leadboards.index",
        }),
        [categories, pipelines, props.stages, leadAgents]
    );

    // Setup search and filter contexts
    const { filter } = usePageSearchAndFilter({
        filterConfig,
    });

    // Extract commonly used values
    const { openDrawer, filters } = filter;

    const handlePipelineChange = (value: number | "all") => {
        // Get current params
        const urlParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlParams.entries());

        // Update pipeline
        params.lead_pipeline_id = String(value);

        // Navigate
        router.get(route("leadboards.index"), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

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
        // Empty as requested
    };

    const handleDeleteColumn = (columnId: number) => {
        // Empty as requested
    };
    const valueLeadPipelineId = (props as any).filters?.lead_pipeline_id
        ? Number((props as any).filters?.lead_pipeline_id)
        : defaultPipeline?.id;

    return (
        <>
            {/* Save Deal Modal - For Edit */}
            <SaveDealModal
                open={action === "edit"}
                onClose={handleClose}
                deal={deal}
            />

            {/* Deal Gathering Form - For Add */}
            <DealInformationGatheringForm
                open={action === "add"}
                onClose={handleClose}
                deal={action === "edit" ? deal : null}
                pipelineId={valueLeadPipelineId}
            />
            <div className="bg-gray-50 min-h-screen">
                <PageLayout
                    title={`${t("app.deal")} | ${t("app.leadboards.kanban")}`}
                    breadcrumbs={[
                        { name: t("app.deal"), url: route("deals.index") },
                        { name: t("app.leadboards.kanban") },
                    ]}
                    searchComp={
                        <UniversalSearchBox
                            placeholder="Search deals by title, contact name, email..."
                            className="w-full"
                        />
                    }
                    filterSection={<ContextualActiveFilters />}
                >
                    <div className="bg-white rounded-lg border border-gray-200 max-w-7xl mx-auto">
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
                                    <PipelineSelector
                                        pipelines={pipelines}
                                        currentPipelineId={valueLeadPipelineId}
                                        onSelect={handlePipelineChange}
                                    />

                                    {(addLeadPermission === "all" ||
                                        addLeadPermission === "added") && (
                                        <Button
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={() => handleCreateDeal()}
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
                                        onClick={openDrawer}
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
                                columns={initialResult.boardColumns}
                                addLeadPermission={addLeadPermission}
                                onCreateDeal={handleCreateDeal}
                                onEditDeal={handleEditDeal}
                                onEditColumn={handleEditColumn}
                                onDeleteColumn={handleDeleteColumn}
                                onColumnsUpdate={handleColumnsUpdate}
                                filters={filters}
                            />
                        </div>
                    </div>
                </PageLayout>
            </div>
            {/* Filter Drawer */}
            <UniversalFilterDrawer config={filterConfig} />

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
        </>
    );
};

LeadBoardIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default LeadBoardIndex;
