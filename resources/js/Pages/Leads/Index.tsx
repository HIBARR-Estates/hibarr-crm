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
    ReloadOutlined,
} from "@ant-design/icons";
import { Link, router } from "@inertiajs/react";
import { Button, MenuProps } from "antd";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { useState } from "react";
import ChangeToClient from "@/Features/Leads/ChangeToClient";
import useTranslation from "@/Hooks/useTranslation";
import { User, Country, ClientCategory, Language } from "@/Types";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import ContextualActiveFilters from "@/Components/ContextualActiveFilters";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { createLeadFilterConfig } from "@/configs/leadFilterConfig";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import { FormDataType, useFormDataBatch } from "@/Hooks/useFormData";
import usePageRefresh from "@/Hooks/usePageRefresh";

export interface IndexProps extends PageProps {
    pageTitle: string;
    leads: PaginatedLeadResponse;
}

const Index = ({
    pageTitle,
    leads,

    ...props
}: IndexProps) => {
    const { t } = useTranslation();

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
        [],
    );

    const { data: formData, loading: formDataLoading } = useFormDataBatch(
        formDataTypes as FormDataType[],
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
        [formData],
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
        [handleAction],
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
                        {t("app.view")}
                    </Link>
                ),
            },
            {
                key: "edit",
                label: (
                    <span>
                        <EditOutlined className="mr-2" />
                        {t("app.edit")}
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
                        {t("app.leads.actions.change_to_client")}
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
                        {t("app.delete")}
                    </span>
                ),
                onClick: () => {
                    handleAction("delete", record);
                },
            },
        ],
        [handleEditLead, handleAction, t],
    );

    const columns = useMemo(
        () => LEAD_TABLE_COLUMNS(getActionItems, t),
        [getActionItems, t],
    );

    // ── Page-level refresh ──────────────────────────────────────────
    const { refresh, isRefreshing } = usePageRefresh();

    return (
        <>
            <PageLayout
                title={t("app.menu.lead")}
                breadcrumbs={[{ name: t("app.menu.lead") }]}
                searchComp={
                    <UniversalSearchBox
                        placeholder={t("app.leads.search_placeholder")}
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
                                {t("app.leads.actions.add")}
                            </Button>
                            <Button
                                type="text"
                                icon={<ImportOutlined />}
                                onClick={handleImportLeads}
                            >
                                {t("app.import")}
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                icon={<ReloadOutlined spin={isRefreshing} />}
                                onClick={refresh}
                                disabled={isRefreshing}
                                type="text"
                            >
                                {t("app.common.actions.refresh")}
                            </Button>
                            {/* Advanced Filters Button */}
                            <Button
                                icon={<FilterOutlined />}
                                onClick={openDrawer}
                            >
                                {t("app.filter")}
                            </Button>

                            {/* Bulk Actions - Only show when items are selected */}
                            {selectedEntities.length > 0 && (
                                <BulkLeadActionSelector
                                    selectedEntityIds={selectedEntities?.map(
                                        ({ id }) => id,
                                    )}
                                    clearSelected={clearSelected}
                                />
                            )}
                        </div>
                    </div>
                    {/* Properties Table */}
                    <DataTable<Lead>
                        columns={columns}
                        dataSource={leads.data}
                        rowKey="id"
                        rowSelection={rowSelection}
                        paginationData={{
                            current_page: leads.current_page,
                            last_page: leads.last_page,
                            per_page: leads.per_page,
                            total: leads.total,
                            from: leads.from,
                            to: leads.to,
                        }}
                        onPageChange={(page) => {
                            router.get(
                                route("lead-contact.index"),
                                {
                                    // ...filters,
                                    ...sortParams,
                                    page,
                                    per_page: leads.per_page,
                                },
                                {
                                    preserveState: true,
                                    preserveScroll: true,
                                },
                            );
                        }}
                        scroll={{ x: 1200, y: "calc(100vh - 280px)" }}
                        size="small"
                    />
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
