import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import BulkLeadActionSelector from "@/Features/Leads/BulkActions/BulkLeadActionSelector";
import SaveDealModal from "@/Features/Deals/SaveDeal/SaveDealModal";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import usePageFilter from "@/Hooks/usePageFilter";
import { LeadCategory, User, LeadSource } from "@/Types/api/leads";
import {
    UserOutlined,
    PlusOutlined,
    DownloadOutlined,
    EditOutlined,
    EyeOutlined,
    DeleteOutlined,
    ImportOutlined,
} from "@ant-design/icons";
import { Link, router } from "@inertiajs/react";
import { Button, MenuProps, Table } from "antd";
import { useState } from "react";
import { DEAL_TABLE_COLUMNS } from "@/Features/Deals/Columns/index";
import { Deal, PaginatedDealResponse } from "@/Types/api/deals";
import DeleteDeal from "@/Features/Deals/DeleteDeal";
import ImportDeals from "@/Features/Deals/ImportDeals";
import BasicDealFilterBox from "@/Features/Deals/Filter/BasicDealFilterBox";

export interface IndexProps extends PageProps {
    pageTitle: string;
    deals: PaginatedDealResponse;
    categories: LeadCategory[];
    sources: LeadSource[];
    employees: User[];
    countries: Array<{ iso: string; nicename: string; iso3: string }>;
    salutations: Array<{ value: string; label: string }>;
}

const Index = ({ pageTitle, deals }: IndexProps) => {
    const {
        handleAction,
        handleClose,
        action,
        selected: deal,
    } = useGenericEntityAction<Deal>();

    // filters and filter handlers
    const {
        filters = {},
        handleQuickFilter,
        handleResetQuickFilters,
        handleResetFilters,
        handleFilterSubmit,
    } = usePageFilter({ handleClose });

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
                    Add Follow Up
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
    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: "Deals" }]}
                filterSection={
                    <BasicDealFilterBox
                        filters={filters}
                        handleResetFilters={handleResetFilters}
                        handleQuickFilter={handleQuickFilter}
                        handleResetQuickFilters={handleResetQuickFilters}
                        handleSubmit={handleFilterSubmit}
                    />
                }
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
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={() => {
                                    handleAction("export");
                                }}
                            >
                                Export
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Bulk Actions - Only show when items are selected */}
                            {selectedEntities.length > 0 && (
                                <BulkLeadActionSelector
                                    selectedEntityIds={selectedEntities?.map(
                                        ({ id }) => id
                                    )}
                                    clearSelected={clearSelected}
                                />
                            )}
                        </div>
                    </div>
                    {/* Properties Table */}
                    <div className="bg-white rounded-lg shadow">
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

            {/* Import Deals Modal */}
            <ImportDeals
                open={action === "import"}
                onClose={() => handleClose()}
            />

            <DeleteDeal
                open={action === "delete"}
                onClose={() => handleClose()}
                deal={deal}
            />
        </DashboardLayout>
    );
};

export default Index;
