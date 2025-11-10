import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import BulkLeadActionSelector from "@/Features/Leads/BulkActions/BulkLeadActionSelector";
import { LEAD_TABLE_COLUMNS } from "@/Features/Leads/Columns";
import BasicLeadFilterBox from "@/Features/Leads/Filter/BasicLeadFilterBox";
import AdvancedLeadFilterForm from "@/Features/Leads/Filter/AdvancedLeadFilterForm";
import SaveLeadModal from "@/Features/Leads/SaveLead/SaveLeadModal";
import ImportLeads from "@/Features/Leads/ImportLeads";
import DeleteLead from "@/Features/Leads/DeleteLead";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import usePageFilter from "@/Hooks/usePageFilter";
import { Lead, LeadCategory, LeadSource } from "@/Types/api/leads";
import { PaginatedLeadResponse } from "@/Types/api/leads";
import FilterDrawer from "@/Components/FilterDrawer";
import ActiveFilters from "@/Components/ActiveFilters";
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
import { useState } from "react";
import ChangeToClient from "@/Features/Leads/ChangeToClient";
import { User, Country, ClientCategory, Language } from "@/Types";

export interface IndexProps extends PageProps {
    pageTitle: string;
    leads: PaginatedLeadResponse;
    categories: LeadCategory[];
    sources: LeadSource[];
    employees: User[];
    countries: Country[];
    salutations: Array<{ value: string; label: string }>;
    clientCategories?: ClientCategory[];
    languages?: Language[];
}

const Index = ({
    pageTitle,
    leads,
    countries,
    salutations,
    clientCategories = [],
    languages = [],
}: IndexProps) => {
    const [importModalOpen, setImportModalOpen] = useState(false);

    const {
        handleAction,
        handleClose,
        action,
        selected: lead,
    } = useGenericEntityAction<Lead>();

    // filters and filter handlers
    const {
        filters,
        drawerOpen,
        openFilterDrawer,
        closeFilterDrawer,
        handleQuickFilter,
        removeFilter,
        handleResetQuickFilters,
        handleResetFilters,
        handleFilterSubmit,
        clearAllFilters,
    } = usePageFilter({ handleClose, routeName: "lead-contact.index" });

    // Table row selection
    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<Lead>();

    // Handle create lead
    const handleCreateLead = () => {
        handleAction("add");
    };

    // Handle edit lead
    const handleEditLead = (lead: Lead) => {
        handleAction("edit", lead);
    };

    // Handle import leads
    const handleImportLeads = () => {
        handleAction("import");
    };
    // Action dropdown for each row
    const getActionItems = (record: Lead): MenuProps["items"] => [
        {
            key: "view",
            label: (
                <Link href={route("lead-contact.show", record.id)}>
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
                handleEditLead(record);
            },
        },
        {
            key: "change_to_client",
            label: (
                <span>
                    <UserOutlined className="mr-2" />
                    Change to Client
                </span>
            ),
            onClick: () => {
                handleAction("change_to_client", record);
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

    const columns = LEAD_TABLE_COLUMNS(getActionItems);
    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: "Leads" }]}
                filterSection={
                    <BasicLeadFilterBox
                        filters={filters}
                        handleResetFilters={handleResetFilters}
                        handleQuickFilter={handleQuickFilter}
                        handleResetQuickFilters={handleResetQuickFilters}
                        handleSubmit={handleFilterSubmit}
                    />
                }
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Active Filters */}
                    <ActiveFilters
                        filters={filters}
                        onRemoveFilter={removeFilter}
                        onClearAll={clearAllFilters}
                    />

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleCreateLead}
                            >
                                Add Lead
                            </Button>
                            <Button
                                type="text"
                                icon={<ImportOutlined />}
                                onClick={handleImportLeads}
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
                            {/* Advanced Filters Button */}
                            <Button
                                icon={<FilterOutlined />}
                                onClick={openFilterDrawer}
                            >
                                Advanced Filters
                            </Button>

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
                            dataSource={leads.data}
                            rowKey="id"
                            rowSelection={rowSelection}
                            pagination={{
                                current: leads.current_page,
                                total: leads.total,
                                pageSize: leads.per_page,
                                showSizeChanger: false,
                                showQuickJumper: false,
                                showTotal: (total, range) =>
                                    `${range[0]}-${range[1]} of ${total} entries`,
                                onChange: (page, pageSize) => {
                                    router.get(
                                        route("lead-contact.index"),
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

            {/* Save Lead Modal */}
            <SaveLeadModal
                open={["add", "edit"].includes(action ?? "")}
                onClose={handleClose}
                lead={lead}
                setLead={(lead) => {
                    if (lead) handleEditLead(lead);
                }}
            />

            {/* Import Leads Modal */}
            <ImportLeads
                open={importModalOpen}
                onClose={() => setImportModalOpen(false)}
            />

            <DeleteLead
                open={action === "delete"}
                onClose={() => handleClose()}
                lead={lead}
            />
            <ChangeToClient
                open={action === "change_to_client"}
                onClose={() => handleClose()}
                lead={lead}
                countries={countries}
                categories={clientCategories}
                salutations={salutations}
                languages={languages}
            />

            {/* Filter Drawer */}
            <FilterDrawer
                open={drawerOpen}
                onClose={closeFilterDrawer}
                title="Advanced Lead Filters"
                filters={filters}
                onApplyFilters={handleFilterSubmit}
                onResetFilters={handleResetFilters}
            >
                <AdvancedLeadFilterForm
                    filters={filters}
                    onFilterChange={handleQuickFilter}
                />
            </FilterDrawer>
        </DashboardLayout>
    );
};

export default Index;
