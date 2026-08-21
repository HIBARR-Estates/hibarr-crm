import { useMemo, useCallback, useEffect, useState, type ReactNode } from "react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import BulkLeadActionSelector from "@/Features/Leads/BulkActions/BulkLeadActionSelector";
import { LEAD_TABLE_COLUMNS } from "@/Features/Leads/Columns";
// dr-btn / dr-pill / modal-panel — the toolbar buttons and Schedule-next-step
// modals render unstyled without this (page-scoped, like QualificationMapping).
import "@/Components/Redesign/redesign.css";
import "@/Features/Leads/leadsTable.css";

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
    SettingOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import { Deferred, Link, router, usePage } from "@inertiajs/react";
import { Button, MenuProps } from "antd";
import { DataTable } from "@/Components/DataTable";
import ChangeToClient from "@/Features/Leads/ChangeToClient";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { User, Country, ClientCategory, Language } from "@/Types";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { createLeadFilterConfig } from "@/configs/leadFilterConfig";
import LeadFilterModal from "@/Features/Filters/EntityFilterModal";
import ActiveFilterSentence from "@/Features/Filters/ActiveFilterSentence";
import { describeFilters } from "@/Features/Filters/filterSummary";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import ContextualActiveFilters from "@/Components/ContextualActiveFilters";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import { FormDataType, useFormDataBatch } from "@/Hooks/useFormData";
import usePageRefresh from "@/Hooks/usePageRefresh";
import usePersistedPageSize from "@/Hooks/usePersistedPageSize";
import FindDuplicatesModal from "@/Features/Leads/Merge/FindDuplicatesModal";
import useLeadMergeAccess from "@/Features/Leads/Merge/useLeadMergeAccess";
import ScheduleNextStepFlow from "@/Features/Leads/NextAction/ScheduleNextStepFlow";
import NextActionDetailFlow, {
    type NextActionRef,
} from "@/Features/Leads/NextAction/NextActionDetailFlow";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import {
    REDESIGN_TOKENS as T,
    REDESIGN_FONT_STACK,
} from "@/Components/Redesign/tokens";

/** Rows-per-page preference, remembered per browser across visits. */
const LEADS_PER_PAGE_STORAGE_KEY = "hibarr_leads_per_page";

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
    meetingTypes?: Array<{ id: number; name: string; color?: string }>;
    nextActionDueThisWeekCount?: number;
    taskBoardColumns?: TaskboardColumn[];
    preferredContactTimes?: Array<{ value: string; label: string }>;
}

const Index = ({
    pageTitle,
    leads,
    leadLifecycleStatuses = [],
    meetingTypes = [],
    nextActionDueThisWeekCount,
    taskBoardColumns = [],
    preferredContactTimes = [],
}: IndexProps) => {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props: pageProps } = usePage<PageProps>();
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
            "lead-custom-fields",
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
                preferredContactTimes,
                utmSources: formData["lead-utm-sources"] || [],
                utmMediums: formData["lead-utm-mediums"] || [],
                utmCampaigns: formData["lead-utm-campaigns"] || [],
                utmContents: formData["lead-utm-contents"] || [],
                utmTerms: formData["lead-utm-terms"] || [],
                utmAudiences: formData["lead-utm-audiences"] || [],
                customFields: formData["lead-custom-fields"] || [],
                leadLifecycleStatuses:
                    leadLifecycleStatuses.length > 0
                        ? leadLifecycleStatuses
                        : formData["lead-lifecycle-statuses"] || [],
                filterV2: useFilterV2,
                excludeFields: ["search"],
            }),
        [formData, leadLifecycleStatuses, preferredContactTimes, useFilterV2],
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

    // "Due this week" pill → next_action=week. filter.setFilter() only
    // writes draft state; filter.applyFilters() reads draftFilters from its
    // OWN closure, so calling both in the same tick would apply the filter
    // from before this click. Deferring the apply to the render after the
    // draft update picks up applyFilters as it looks once the draft is set.
    const [applyWeekFilterPending, setApplyWeekFilterPending] = useState(false);
    useEffect(() => {
        if (!applyWeekFilterPending) return;
        filter.applyFilters();
        setApplyWeekFilterPending(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applyWeekFilterPending]);

    const handleDueThisWeekClick = useCallback(() => {
        filter.setFilter("next_action", "week", "Next action", "Due this week");
        setApplyWeekFilterPending(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Table row selection (pageData keeps selections when paging)
    const [selectAllMatching, setSelectAllMatching] = useState(false);
    const exitSelectAllMatching = useCallback(
        () => setSelectAllMatching(false),
        [],
    );
    const {
        selectedEntities,
        rowSelection,
        clearSelected: clearRowSelection,
    } = useGenericTableRowSelection<Lead>({
        pageData: leads.data,
        selectAllMatching,
        onExitSelectAllMatching: exitSelectAllMatching,
    });

    const clearSelected = useCallback(() => {
        setSelectAllMatching(false);
        clearRowSelection();
    }, [clearRowSelection]);

    const handleSelectAllMatching = useCallback(() => {
        setSelectAllMatching(true);
    }, []);

    // Result set size changed (new filters/search) — drop "all matching".
    useEffect(() => {
        setSelectAllMatching(false);
    }, [leads.total]);

    const { persistPageSize } = usePersistedPageSize({
        storageKey: LEADS_PER_PAGE_STORAGE_KEY,
        currentPerPage: leads.per_page,
        onRestore: (perPage) =>
            router.get(
                route("lead-contact.index"),
                mergeQueryParams({ page: 1, per_page: perPage }),
                { only: ["leads"], preserveState: true, preserveScroll: true },
            ),
    });

    const canMergeLeads = useLeadMergeAccess();
    // Mirrors QualificationFieldMappingController::assertCanManage.
    const canManageQualificationMapping =
        pageProps.auth?.permissions?.manage_qualification_mapping === "all";
    const [findDuplicatesLead, setFindDuplicatesLead] = useState<Lead | null>(
        null,
    );
    const [scheduleNextStepLead, setScheduleNextStepLead] =
        useState<Lead | null>(null);
    const [openNextAction, setOpenNextAction] = useState<NextActionRef | null>(
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
        () =>
            LEAD_TABLE_COLUMNS({
                actionItems: getActionItems,
                t,
                td,
                onScheduleNextStep: setScheduleNextStepLead,
                onOpenNextAction: setOpenNextAction,
            }),
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
                <div
                    className="max-w-[1560px] mx-auto space-y-4"
                    style={{ fontFamily: REDESIGN_FONT_STACK }}
                >
                    <div
                        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-[10px] border px-4 py-3.5 bg-white"
                        style={{ borderColor: T.BORDER }}
                    >
                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                className="dr-btn dr-btn-primary"
                                onClick={handleCreateLead}
                            >
                                <PlusOutlined style={{ fontSize: 13 }} />
                                {t("app.leads.actions.add")}
                            </button>
                            <button
                                type="button"
                                className="dr-btn dr-btn-ghost"
                                onClick={handleImportLeads}
                            >
                                <ImportOutlined style={{ fontSize: 13 }} />
                                {t("app.import")}
                            </button>
                        </div>

                        <div className="flex items-center gap-2.5">
                            {typeof nextActionDueThisWeekCount === "number" &&
                                nextActionDueThisWeekCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleDueThisWeekClick}
                                        className="inline-flex items-center rounded-md font-semibold cursor-pointer"
                                        style={{
                                            gap: 7,
                                            padding: "9px 14px",
                                            fontSize: 14,
                                            border: `1px solid ${T.NAVY_MID}`,
                                            background: T.NAVY_SOFT,
                                            color: T.NAVY,
                                        }}
                                    >
                                        <ClockCircleOutlined style={{ fontSize: 14 }} />
                                        {td("Due this week", { source: "en" })} ·{" "}
                                        {nextActionDueThisWeekCount}
                                    </button>
                                )}
                            {canManageQualificationMapping && (
                                <Link
                                    href={route(
                                        "qualification-field-mapping.index",
                                    )}
                                    className="dr-btn dr-btn-ghost"
                                    title={td(
                                        "Qualification script field mapping",
                                        { source: "en" },
                                    )}
                                    aria-label={td(
                                        "Qualification script field mapping",
                                        { source: "en" },
                                    )}
                                >
                                    <SettingOutlined style={{ fontSize: 13 }} />
                                </Link>
                            )}
                            <button
                                type="button"
                                className="dr-btn dr-btn-ghost"
                                onClick={refresh}
                                disabled={isRefreshing}
                            >
                                <ReloadOutlined
                                    spin={isRefreshing}
                                    style={{ fontSize: 13 }}
                                />
                                {td("Refresh", { source: "en" })}
                            </button>
                            {/* Advanced Filters Button */}
                            <button
                                type="button"
                                className="dr-btn dr-btn-ghost"
                                onClick={openDrawer}
                            >
                                <FilterOutlined style={{ fontSize: 13 }} />
                                {t("app.filter")}
                                {useFilterV2 && activeFilterCount > 0 && (
                                    <span
                                        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-full text-[11px] font-semibold"
                                        style={{ background: T.BLUE, color: T.WHITE }}
                                    >
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Bulk actions — appear once a row is selected, full-width
                        below the toolbar. "Select all matching" lives inside it. */}
                    {(selectAllMatching || selectedEntities.length > 0) && (
                        <BulkLeadActionSelector
                            selectedEntityIds={selectedEntities.map(
                                ({ id }) => id,
                            )}
                            matchingTotal={leads.total}
                            selectAllMatching={selectAllMatching}
                            onSelectAllMatching={handleSelectAllMatching}
                            clearSelected={clearSelected}
                            optionsLoading={formDataLoading}
                            updateOptions={{
                                categories: formData.categories || [],
                                sources: formData.sources || [],
                                employees: formData.employees || [],
                                temperatures: formData.temperatures || [],
                                leadLifecycleStatuses,
                            }}
                        />
                    )}

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
                        stripe={false}
                        containerClassName="leads-table"
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
                        onPageSizeChange={(pageSize) => {
                            persistPageSize(pageSize);
                            router.get(
                                route("lead-contact.index"),
                                mergeQueryParams({
                                    page: 1,
                                    per_page: pageSize,
                                }),
                                {
                                    only: ["leads"],
                                    preserveState: true,
                                    preserveScroll: true,
                                },
                            );
                        }}
                        scroll={{ x: "max-content", y: "calc(100vh - 220px)" }}
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

            <ScheduleNextStepFlow
                lead={scheduleNextStepLead}
                onClose={() => setScheduleNextStepLead(null)}
                meetingTypes={meetingTypes}
            />

            <NextActionDetailFlow
                action={openNextAction}
                onClose={() => setOpenNextAction(null)}
                taskBoardColumns={taskBoardColumns}
            />

            {/* Filter UI — v2 two-pane workbench behind crm.leads-filter-v2,
                otherwise the shared universal filter modal. */}
            <Deferred
                data="preferredContactTimes"
                fallback={
                    useFilterV2 ? (
                        <LeadFilterModal
                            config={filterConfig}
                            optionsLoading
                        />
                    ) : (
                        <UniversalFilterDrawer
                            config={filterConfig}
                            loading
                            width={960}
                        />
                    )
                }
            >
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
            </Deferred>
        </>
    );
};

Index.layout = (page: ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
