import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import BulkDealActionSelector from "@/Features/Deals/BulkActions/BulkDealActionSelector";
import SaveDealModal from "@/Features/Deals/SaveDeal/SaveDealModal";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import usePageSort from "@/Hooks/usePageSort";
import { LeadCategory, LeadSource } from "@/Types/api/leads";
import { PipelineStage } from "@/Types/api/deals";
import ContextualActiveFilters from "@/Components/ContextualActiveFilters";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import createDealFilterConfig from "@/configs/dealFilterConfig";
import { createDealSearchConfig } from "@/configs/searchConfigs";
import {
    UserOutlined,
    PlusOutlined,
    DownloadOutlined,
    EditOutlined,
    EyeOutlined,
    DeleteOutlined,
    ImportOutlined,
    FilterOutlined,
} from "@ant-design/icons";
import { Link, router } from "@inertiajs/react";
import { Button, MenuProps, Table } from "antd";
import { DEAL_TABLE_COLUMNS } from "@/Features/Deals/Columns/index";
import { Deal, PaginatedDealResponse } from "@/Types/api/deals";
import DeleteDeal from "@/Features/Deals/DeleteDeal";
import ImportDeals from "@/Features/Deals/ImportDeals";
import { User } from "@/Types";
import AddFollowup from "./Components/Tabs/followups/AddFollowup";
import DealsModeSwitcher from "@/Components/Kanban/DealsModeSwitcher";

interface LeadAgent {
    id: number;
    user_id?: number;
    name: string;
    image?: string;
    user?: Pick<User, "id" | "name" | "email" | "image_url">;
}

export interface IndexProps extends PageProps {
    pageTitle: string;
    deals: PaginatedDealResponse;
    categories: LeadCategory[];
    sources: LeadSource[];
    stages: PipelineStage[];
    leadAgents: LeadAgent[];
    employees: User[];
    countries: Array<{ iso: string; nicename: string; iso3: string }>;
    salutations: Array<{ value: string; label: string }>;
}

const Index = ({
    pageTitle,
    deals,
    stages,
    leadAgents,
    ...props
}: IndexProps) => {
    const {
        handleAction,
        handleClose,
        action,
        selected: deal,
    } = useGenericEntityAction<Deal>();

    // Setup search and filter contexts
    const { filter, search } = usePageSearchAndFilter({
        filterConfig: createDealFilterConfig(props),
        searchConfig: createDealSearchConfig(),
    });

    // Extract commonly used values
    const { openDrawer, filters } = filter;

    // Sort handlers
    const { sortParams } = usePageSort({ routeName: "deals.index" });

    // Table row selection
    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<Deal>();

    // Handle create deal
    const handleCreateDeal = () => {
        handleAction("add");
    };

    // Handle edit deal
    const handleEditDeal = (deal: Deal) => {
        handleAction("edit", deal);
    };

    // Handle import deals
    const handleImportDeals = () => {
        handleAction("import");
    };
    // Action dropdown for each row
    const getActionItems = (record: Deal): MenuProps["items"] => [
        {
            key: "view",
            label: (
                <Link href={route("deals.show", record.id)}>
                    <EyeOutlined className="mr-2" />
                    View
                </Link>
            ),
        },
        {
            key: "edit",
            label: (
                <span>
                    <EditOutlined className="mr-2" />
                    Edit
                </span>
            ),
            onClick: () => {
                handleEditDeal(record);
            },
        },
        {
            key: "add_follow_up",
            label: (
                <span>
                    <UserOutlined className="mr-2" />
                    Schedule Meeting
                </span>
            ),
            onClick: () => {
                handleAction("add_follow_up", record);
            },
        },
        {
            type: "divider",
        },
        {
            key: "delete",
            label: (
                <span className="text-red-600">
                    <DeleteOutlined className="mr-2" />
                    Delete
                </span>
            ),
            onClick: () => {
                handleAction("delete", record);
            },
        },
    ];

    const columns = DEAL_TABLE_COLUMNS(getActionItems);

    console.log("Rendering Deals Index with deals:", deals);
    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: "Deals" }]}
                searchComp={
                    <UniversalSearchBox
                        placeholder="Search deals by title, contact name, email..."
                        className="w-full"
                    />
                }
                filterSection={<ContextualActiveFilters />}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleCreateDeal}
                            >
                                Add Deal
                            </Button>
                            <Button
                                type="text"
                                icon={<ImportOutlined />}
                                onClick={handleImportDeals}
                            >
                                Import
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Advanced Filters Button */}
                            <div className="flex items-center gap-x-2">
                                <Button
                                    icon={<FilterOutlined />}
                                    onClick={openDrawer}
                                >
                                    Filters
                                </Button>
                                <DealsModeSwitcher />
                            </div>

                            {/* Bulk Actions - Only show when items are selected */}
                            {selectedEntities.length > 0 && (
                                <BulkDealActionSelector
                                    selectedEntityIds={selectedEntities?.map(
                                        ({ id }) => id
                                    )}
                                    stages={stages}
                                    leadAgents={leadAgents}
                                    clearSelected={clearSelected}
                                />
                            )}
                        </div>
                    </div>
                    {/* Properties Table */}
                    <div className="bg-white rounded-lg border border-gray-200 px-3">
                        <Table
                            columns={columns}
                            dataSource={deals.data}
                            rowKey="id"
                            rowSelection={rowSelection}
                            pagination={{
                                current: deals.current_page,
                                total: deals.total,
                                pageSize: deals.per_page,
                                showSizeChanger: false,
                                showQuickJumper: false,
                                showTotal: (total, range) =>
                                    `${range[0]}-${range[1]} of ${total} entries`,
                                onChange: (page, pageSize) => {
                                    router.get(
                                        route("deals.index"),
                                        {
                                            ...filters,
                                            search: search.query,
                                            ...sortParams,
                                            page,
                                            per_page: pageSize,
                                        },
                                        {
                                            preserveState: true,
                                            preserveScroll: true,
                                        }
                                    );
                                },
                            }}
                            scroll={{ x: 1200 }}
                            size="small"
                        />
                    </div>
                </div>
            </PageLayout>

            {/* Save Deal Modal */}
            <SaveDealModal
                open={["add", "edit"].includes(action ?? "")}
                onClose={handleClose}
                deal={deal}
                setDeal={(deal) => {
                    if (deal) handleEditDeal(deal);
                }}
            />

            <DeleteDeal
                open={action === "delete"}
                onClose={() => handleClose()}
                deal={deal}
            />

            {/* Add Follow-up Modal */}
            {deal && (
                <AddFollowup
                    open={action === "add_follow_up"}
                    onClose={() => handleClose()}
                    deal={deal}
                />
            )}

            {/* Import Deals Modal */}
            <ImportDeals
                open={action === "import"}
                onClose={() => handleClose()}
            />

            {/* Universal Filter Drawer */}
            <UniversalFilterDrawer config={createDealFilterConfig(props)} />
        </DashboardLayout>
    );
};

export default Index;
