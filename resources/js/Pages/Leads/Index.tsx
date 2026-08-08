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
    MergeCellsOutlined,
} from "@ant-design/icons";
import { Link, router, usePage } from "@inertiajs/react";
import { Button, MenuProps } from "antd";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { useState } from "react";
import ChangeToClient from "@/Features/Leads/ChangeToClient";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { User, Country, ClientCategory, Language } from "@/Types";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { createLeadFilterConfig } from "@/configs/leadFilterConfig";
import LeadFilterModal from "@/Features/Leads/Filters/LeadFilterModal";
import ActiveFilterSentence from "@/Features/Leads/Filters/ActiveFilterSentence";
import { describeFilters } from "@/Features/Leads/Filters/filterSummary";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import ContextualActiveFilters from "@/Components/ContextualActiveFilters";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import { FormDataType, useFormDataBatch } from "@/Hooks/useFormData";
import usePageRefresh from "@/Hooks/usePageRefresh";
import FindDuplicatesModal from "@/Features/Leads/Merge/FindDuplicatesModal";
import useLeadMergeAccess from "@/Features/Leads/Merge/useLeadMergeAccess";

export interface IndexProps extends Omit<PageProps, "filters"> {
    pageTitle: string;
    leads: PaginatedLeadResponse;
    filters?: Record<string, string | undefined>;
    leadLifecycleStatuses?: Array<{
        id: number;
        label: string;
        key: string;
        label_color?: string;
    }>;
}

const Index = ({
    pageTitle,
    leads,
    leadLifecycleStatuses = [],
}: IndexProps) => {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props: pageProps } = usePage<PageProps>();
    const useLeadCoreFields =
        pageProps.featureFlags?.["crm.lead-language-core-field"] === true;
    // Redesigned two-pane filter workbench + saved views (mockups 1a/2a/2b/3c).
    const useFilterV2 =
        pageProps.featureFlags?.["crm.leads-filter-v2"] === true;

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
            "languages",
            "genders",
            "age-ranges",
            "temperatures",
            "lead-utm-sources",
            "lead-utm-mediums",
            "lead-utm-campaigns",
            "lead-utm-contents",
            "lead-utm-terms",
            "lead-utm-audiences",
        ],
        [],
    );

    const { data: formData, loading: formDataLoading } = useFormDataBatch(
        formDataTypes as FormDataType[],
    );

    // Memoize configs to prevent unnecessary re-renders and filter resets
    const filterConfig = useMemo(
        () =>
            createLeadFilterConfig({
                sources: formData.sources || [],
                categories: formData.categories || [],
                employees: formData.employees || [],
                countries: formData.countries || [],
                languages: formData.languages || [],
                genders: formData.genders || [],
                ageRanges: formData["age-ranges"] || [],
                temperatures: formData.temperatures || [],
                utmSources: formData["lead-utm-sources"] || [],
                utmMediums: formData["lead-utm-mediums"] || [],
                utmCampaigns: formData["lead-utm-campaigns"] || [],
                utmContents: formData["lead-utm-contents"] || [],
                utmTerms: formData["lead-utm-terms"] || [],
                utmAudiences: formData["lead-utm-audiences"] || [],
                leadLifecycleStatuses:
                    leadLifecycleStatuses.length > 0
                        ? leadLifecycleStatuses
                        : formData["lead-lifecycle-statuses"] || [],
                useLeadCoreFields,
                filterV2: useFilterV2,
                excludeFields: ["search"],
            }),
        [formData, leadLifecycleStatuses, useLeadCoreFields, useFilterV2],
    );

    // Setup search and filter contexts
    const { filter } = usePageSearchAndFilter({
        filterConfig,
    });

    // Extract commonly used values
    const { openDrawer } = filter;
    // Count clauses, not raw keys, so the badge matches the filter sentence
    // (a date range is two keys but reads as one filter).
    const activeFilterCount = useMemo(
        () => describeFilters(filter.config, filter.filters).length,
        [filter.config, filter.filters],
    );

    // Table row selection
    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<Lead>();

    const canMergeLeads = useLeadMergeAccess();
    const [findDuplicatesLead, setFindDuplicatesLead] = useState<Lead | null>(
        null,
    );

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
            ...(canMergeLeads
                ? [
                      {
                          key: "find_duplicates",
                          label: (
                              <span>
                                  <MergeCellsOutlined className="mr-2" />
                                  {td("Find Duplicates", { source: "en" })}
                              </span>
                          ),
                          onClick: () => {
                              setFindDuplicatesLead(record);
                          },
                      },
                  ]
                : []),
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
        [handleEditLead, handleAction, t, td, canMergeLeads],
    );

    const columns = useMemo(
        () => LEAD_TABLE_COLUMNS({ actionItems: getActionItems, t, td }),
        [getActionItems, t, td],
    );

    // ── Page-level refresh ──────────────────────────────────────────
    // X2: refresh only the leads list (lifecycle statuses/filters are stable)
    const { refresh, isRefreshing } = usePageRefresh({
        onRefresh: async () => {
            await new Promise<void>((resolve, reject) => {
                router.reload({
                    only: ["leads"],
                    onSuccess: () => resolve(),
                    onError: (errors) => reject(errors),
                });
            });
        },
    });

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
                filterSection={
                    useFilterV2 ? undefined : <ContextualActiveFilters />
                }
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
                                {td("Refresh", { source: "en" })}
                            </Button>
                            {/* Advanced Filters Button */}
                            <Button
                                icon={<FilterOutlined />}
                                onClick={openDrawer}
                            >
                                {t("app.filter")}
                                {useFilterV2 && activeFilterCount > 0 && (
                                    <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-full bg-[#1a6bb5] text-white text-[11px] font-semibold">
                                        {activeFilterCount}
                                    </span>
                                )}
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

                    {/* 3c — quiet active-filter sentence */}
                    {useFilterV2 && (
                        <ActiveFilterSentence
                            count={leads.total}
                            onOpenFilters={openDrawer}
                        />
                    )}

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
                            // X2: pagination only needs the leads list
                            router.get(
                                route("lead-contact.index"),
                                mergeQueryParams({
                                    page,
                                    per_page: leads.per_page,
                                }),
                                {
                                    only: ["leads"],
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
                reloadKeys={["leads"]}
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

            {canMergeLeads && (
                <FindDuplicatesModal
                    open={Boolean(findDuplicatesLead)}
                    onClose={() => setFindDuplicatesLead(null)}
                    leadId={findDuplicatesLead?.id ?? 0}
                    leadName={findDuplicatesLead?.client_name}
                />
            )}

            {/* Filter UI — v2 two-pane workbench behind crm.leads-filter-v2,
                otherwise the shared universal filter modal. */}
            {useFilterV2 ? (
                <LeadFilterModal
                    config={filterConfig}
                    optionsLoading={formDataLoading}
                />
            ) : (
                <UniversalFilterDrawer
                    config={filterConfig}
                    loading={formDataLoading}
                    width={960}
                />
            )}
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
