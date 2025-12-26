import { useMemo, useCallback } from "react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import BulkLeadActionSelector from "@/Features/Leads/BulkActions/BulkLeadActionSelector";
import { LEAD_TABLE_COLUMNS } from "@/Features/Leads/Columns";

import SaveLeadModal from "@/Features/Leads/SaveLead/SaveLeadModal";
import ImportLeads from "@/Features/Leads/ImportLeads";
import DeleteLead from "@/Features/Leads/DeleteLead";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";

import usePageSort from "@/Hooks/usePageSort";
import { Lead, LeadCategory, LeadSource } from "@/Types/api/leads";
import { PaginatedLeadResponse } from "@/Types/api/leads";

import {
    UserOutlined,
    PlusOutlined,
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
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import ContextualActiveFilters from "@/Components/ContextualActiveFilters";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { createLeadFilterConfig } from "@/configs/leadFilterConfig";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import { FormDataType, useFormDataBatch } from "@/Hooks/useFormData";

export interface IndexProps extends PageProps {
    pageTitle: string;
    leads: PaginatedLeadResponse;
}

const Index = ({
    pageTitle,
    leads,

    ...props
}: IndexProps) => {
    const {
        handleAction,
        handleClose,
        action,
        selected: lead,
    } = useGenericEntityAction<Lead>();

    // Memoize the types array to ensure referential stability
    const formDataTypes = useMemo(
        () => [
            "sources",
            "categories",
            "employees",
            "countries",
            "client-categories",
            "languages",
        ],
        []
    );

    const { data: formData, loading: formDataLoading } = useFormDataBatch(
        formDataTypes as FormDataType[]
    );
    console.log(formData, "FORM DATA");
    // // Memoize configs to prevent unnecessary re-renders and filter resets
    const filterConfig = useMemo(
        () =>
            createLeadFilterConfig({
                sources: formData.sources || [],
                categories: formData.categories || [],
                employees: formData.employees || [],
                countries: formData.countries || [],
                clientCategories: formData["client-categories"] || [],
                languages: formData.languages || [],
                excludeFields: ["search"],
            }),
        [formData]
    );

    // Setup search and filter contexts
    const { filter } = usePageSearchAndFilter({
        filterConfig,
    });

    // Extract commonly used values
    const { openDrawer, filters } = filter;

    // Sort handlers
    const { sortParams } = usePageSort({ routeName: "lead-contact.index" });

    // Table row selection
    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<Lead>();

    // Handle create lead
    const handleCreateLead = useCallback(() => {
        handleAction("add");
    }, [handleAction]);

    // Handle edit lead
    const handleEditLead = useCallback(
        (lead: Lead) => {
            handleAction("edit", lead);
        },
        [handleAction]
    );

    // Handle import leads
    const handleImportLeads = useCallback(() => {
        handleAction("import");
    }, [handleAction]);

    // Action dropdown for each row
    const getActionItems = useCallback(
        (record: Lead): MenuProps["items"] => [
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
        ],
        [handleEditLead, handleAction]
    );

    const columns = useMemo(
        () => LEAD_TABLE_COLUMNS(getActionItems),
        [getActionItems]
    );

    return (
        <>
            <PageLayout
                title={`Leads`}
                breadcrumbs={[{ name: "Leads" }]}
                searchComp={
                    <UniversalSearchBox
                        placeholder="Search leads by lead name, email, company..."
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
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Advanced Filters Button */}
                            <Button
                                icon={<FilterOutlined />}
                                onClick={openDrawer}
                            >
                                Filters
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
                    <div className="bg-white rounded-lg border border-gray-200">
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
                                            // ...filters,
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
                open={action === "import"}
                onClose={() => handleClose()}
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
            />

            {/* Universal Filter Drawer */}
            {
                <UniversalFilterDrawer
                    config={filterConfig}
                    loading={formDataLoading}
                />
            }
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
