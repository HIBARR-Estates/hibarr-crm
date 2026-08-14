import DealInformationGatheringForm from "@/Features/Deals/DealInformationGathering/DealInformationGatheringForm";
import SaveDealModal from "@/Features/Deals/SaveDeal/SaveDealModal";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import "@/Components/Redesign/redesign.css";
import {
    REDESIGN_TOKENS as T,
    REDESIGN_FONT_STACK,
} from "@/Components/Redesign/tokens";
import PageLayout from "@/Components/PageLayout";
import BulkDealActionSelector from "@/Features/Deals/BulkActions/BulkDealActionSelector";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import useViewPreference from "@/Hooks/useViewPreference";
import { PipelineStage } from "@/Types/api/deals";
import EntityFilterModal from "@/Features/Filters/EntityFilterModal";
import ActiveFilterSentence from "@/Features/Filters/ActiveFilterSentence";
import { describeFilters } from "@/Features/Filters/filterSummary";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import createDealFilterConfig from "@/configs/dealFilterConfig";
import { createDealSearchConfig } from "@/configs/searchConfigs";
import { getDealPermissions } from "@/Hooks/useDealPermissions";
import { FormDataType, useFormDataBatch } from "@/Hooks/useFormData";
import { dealApi } from "@/lib/api/deals";
import {
    UserOutlined,
    PlusOutlined,
    DownloadOutlined,
    EditOutlined,
    EyeOutlined,
    DeleteOutlined,
    ImportOutlined,
    FilterOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import { Link, router, usePage } from "@inertiajs/react";
import { MenuProps, Spin } from "antd";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { DEAL_TABLE_COLUMNS } from "@/Features/Deals/Columns/index";
import { Deal, PaginatedDealResponse } from "@/Types/api/deals";
import DeleteDeal from "@/Features/Deals/DeleteDeal";
import ImportDeals from "@/Features/Deals/ImportDeals";
import { User } from "@/Types";
import AddFollowup from "./Components/Tabs/followups/AddFollowup";
import DealsModeSwitcher from "@/Components/Kanban/DealsModeSwitcher";
import { useMemo, useState, useCallback } from "react";
import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import PipelineSelector from "@/Features/Deals/PipelineSelector";
import KanbanBoard from "@/Components/Kanban/KanbanBoard";
import usePageRefresh from "@/Hooks/usePageRefresh";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import usePersistedPageSize from "@/Hooks/usePersistedPageSize";

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

/** S1: Index no longer ships form/filter option arrays (M1/M3 fetch those). */
export interface IndexProps extends Omit<PageProps, "filters"> {
    pageTitle: string;
    deals: PaginatedDealResponse;
    boardColumns: BoardColumn[];
    allPipelines: Pipeline[];
    defaultPipeline?: Pipeline | null;
    filters?: {
        lead_pipeline_id?: string;
        pipeline_stage_id?: string;
        category_id?: string;
        source_id?: string;
        package_id?: string;
        agent_id?: string;
        search?: string;
        start_date?: string;
        end_date?: string;
        close_start?: string;
        close_end?: string;
        outcome_status?: string;
        is_locked?: string;
        view?: string;
    };
    addLeadPermission?: string;
}

const Index = ({
    pageTitle,
    deals,
    boardColumns: initialBoardColumns,
    allPipelines: pipelines,
    defaultPipeline,
    filters: pageFilters,
    addLeadPermission = "all",
}: IndexProps) => {
    const { t } = useTranslation();

    // Get current user and permissions for deal permission checks
    const { props: pageProps } = usePage<any>();
    const currentUser = pageProps.auth?.user;
    const editDealsPermission = pageProps.auth?.permissions?.edit_deals;
    const deleteDealsPermission = pageProps.auth?.permissions?.delete_deals;
    const isAdmin = Boolean(
        currentUser?.roles?.some(
            (role: { name?: string }) => role?.name === "admin",
        ),
    );
    const { td } = useTd();

    const queryClient = useQueryClient();

    // View mode state: table or kanban (persisted in localStorage)
    const { view, setView, isTableView, isKanbanView } = useViewPreference({
        storageKey: "deals",
        defaultView: "table",
    });

    const [boardColumnsLoading, setBoardColumnsLoading] = useState(
        () =>
            view === "kanban" && (initialBoardColumns?.length ?? 0) === 0,
    );

    /** K2: fetch board column metadata only (cards still load via kanban API). */
    const loadBoardColumns = useCallback((nextView: "kanban" | "table" = "kanban") => {
        setBoardColumnsLoading(nextView === "kanban");
        router.get(
            route("deals.index"),
            mergeQueryParams({ view: nextView }),
            {
                only: ["boardColumns"],
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onFinish: () => setBoardColumnsLoading(false),
                onError: () => setBoardColumnsLoading(false),
            },
        );
    }, []);

    // Cold-load sync: localStorage kanban + missing ?view= would otherwise get empty boardColumns (K1/K2).
    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlView = urlParams.get("view");
        const effectiveUrlView =
            urlView === "kanban" || urlView === "table" ? urlView : "table";

        if (view === effectiveUrlView) {
            return;
        }

        if (view === "kanban") {
            loadBoardColumns("kanban");
        } else {
            loadBoardColumns("table");
        }
        // Mount-only: align URL with stored preference once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleViewChange = useCallback(
        (nextView: "kanban" | "table") => {
            setView(nextView);
            // Kanban needs boardColumns; table only needs URL/view sync (server returns []).
            loadBoardColumns(nextView);
        },
        [setView, loadBoardColumns],
    );

    // Board columns state for kanban view
    const [boardColumns, setBoardColumns] =
        useState<BoardColumn[]>(initialBoardColumns);

    // Update board columns when props change
    React.useEffect(() => {
        setBoardColumns(initialBoardColumns ?? []);
        if ((initialBoardColumns?.length ?? 0) > 0) {
            setBoardColumnsLoading(false);
        }
    }, [initialBoardColumns]);

    const showKanbanLoading = isKanbanView && boardColumnsLoading;

    const {
        handleAction,
        handleClose,
        action,
        selected: deal,
    } = useGenericEntityAction<Deal>();

    // M3/S1: filter + bulk-action options come from form-data batch (not Index props)
    const filterFormDataTypes = useMemo(
        () =>
            [
                "categories",
                "sources",
                "packages",
                "lead-agents",
                "lead-pipelines",
                "lead-stages",
                "employees",
            ] as FormDataType[],
        [],
    );

    const { data: filterFormData, loading: formDataLoading } =
        useFormDataBatch(filterFormDataTypes);

    // "all" unpins the list from a single pipeline; a multi-pipeline filter
    // value counts as unpinned too (the chip, not the selector, tells the truth).
    const rawPipelineFilter = pageFilters?.lead_pipeline_id;
    const activePipelineId: number | "all" =
        rawPipelineFilter === "all" || rawPipelineFilter?.includes(",")
            ? "all"
            : rawPipelineFilter
              ? Number(rawPipelineFilter)
              : (defaultPipeline?.id ?? pipelines[0]?.id ?? 0);

    // Bulk update workbench options (stage / agent / watchers).
    const bulkUpdateOptions = useMemo(
        () => ({
            stages: (Array.isArray(filterFormData["lead-stages"])
                ? filterFormData["lead-stages"]
                : []) as PipelineStage[],
            leadAgents: (Array.isArray(filterFormData["lead-agents"])
                ? filterFormData["lead-agents"]
                : []) as LeadAgent[],
            employees: (Array.isArray(filterFormData.employees)
                ? filterFormData.employees
                : []) as Array<{ id: number; name: string }>,
            activePipelineId,
        }),
        [filterFormData, activePipelineId],
    );

    // Memoize configs to prevent unnecessary re-renders and filter resets
    const filterConfig = useMemo(() => {
        const pick = (type: string, fallback: any[] = []) => {
            const value = filterFormData[type];
            return Array.isArray(value) && value.length > 0 ? value : fallback;
        };

        return createDealFilterConfig({
            categories: pick("categories"),
            sources: pick("sources"),
            packages: pick("packages"),
            leadAgents: pick("lead-agents"),
            leadPipelines: pick("lead-pipelines", pipelines || []),
            stages: pick("lead-stages"),
            activePipelineId,
            excludeFields: ["search"],
        });
    }, [filterFormData, pipelines, activePipelineId]);

    // Setup search and filter contexts
    const { filter } = usePageSearchAndFilter({
        filterConfig,
    });

    // Extract commonly used values
    const { openDrawer, filters } = filter;

    // Count clauses, not raw keys, so the badge matches the filter sentence
    // (a date range is two keys but reads as one filter).
    const activeFilterCount = useMemo(
        () => describeFilters(filter.config, filter.filters).length,
        [filter.config, filter.filters],
    );

    const handlePipelineChange = (value: number | "all") => {
        // Get current params
        const urlParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlParams.entries());

        // Update pipeline; keep view so server stays view-aware (K1)
        params.lead_pipeline_id = String(value);
        params.view = view;

        // X2: only refresh list props (+ board columns in kanban); filters drives valueLeadPipelineId
        router.get(route("deals.index"), params, {
            only: isKanbanView
                ? ["deals", "boardColumns", "filters"]
                : ["deals", "filters"],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

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
    } = useGenericTableRowSelection<Deal>({
        pageData: deals.data,
        selectAllMatching,
        onExitSelectAllMatching: exitSelectAllMatching,
    });

    const clearSelected = useCallback(() => {
        setSelectAllMatching(false);
        clearRowSelection();
    }, [clearRowSelection]);

    // Result set size changed (new filters/search) — drop "all matching".
    React.useEffect(() => {
        setSelectAllMatching(false);
    }, [deals.total]);

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

    // Handle schedule meeting (follow up)
    const handleScheduleMeeting = useCallback(
        (deal: Deal) => {
            handleAction("add_follow_up", deal);
        },
        [handleAction],
    );

    // Change Agent Mutation
    const { mutate: changeAgent } = dealApi.useChangeAgent();

    // Handle agent change from table or card
    const handleAgentChange = useCallback(
        (deal: Deal, agentId: number | null) => {
            changeAgent(
                { deal_id: deal.id, agent_id: agentId },
                {
                    onSuccess: () => {
                        // K3: table skips boardColumns; kanban refreshes column metadata + card cache
                        router.reload({
                            only: isKanbanView
                                ? ["deals", "boardColumns"]
                                : ["deals"],
                        });
                        if (isKanbanView) {
                            queryClient.invalidateQueries({
                                queryKey: [route("deals.kanban_deals")],
                            });
                        }
                    },
                },
            );
        },
        [changeAgent, isKanbanView, queryClient],
    );

    // Helper to check if user can edit a specific deal
    const canEditDeal = useCallback(
        (deal: Deal): boolean => {
            const { canEdit } = getDealPermissions(
                deal,
                currentUser?.id,
                editDealsPermission,
                undefined,
                isAdmin,
            );
            return canEdit;
        },
        [currentUser?.id, editDealsPermission, isAdmin],
    );

    // Action dropdown for each row - respects deal permissions (watchers can't edit/delete)
    const getActionItems = (record: Deal): MenuProps["items"] => {
        // Get permissions for this specific deal
        const { canEdit, canDelete } = getDealPermissions(
            record,
            currentUser?.id,
            editDealsPermission,
            deleteDealsPermission,
            isAdmin,
        );

        return [
            {
                key: "view",
                label: (
                    <Link href={route("deals.show", record.id)}>
                        <EyeOutlined className="mr-2" />
                        {t("app.view")}
                    </Link>
                ),
            },
            // Edit - only show if user has edit permission (not for watchers)
            ...(canEdit
                ? [
                      {
                          key: "edit",
                          label: (
                              <span>
                                  <EditOutlined className="mr-2" />
                                  {t("app.edit")}
                              </span>
                          ),
                          onClick: () => {
                              handleEditDeal(record);
                          },
                      },
                  ]
                : []),
            {
                key: "add_follow_up",
                label: (
                    <span>
                        <UserOutlined className="mr-2" />
                        {t("app.deals.actions.schedule_meeting")}
                    </span>
                ),
                onClick: () => {
                    handleAction("add_follow_up", record);
                },
            },
            // Delete - only show if user has delete permission (not for watchers)
            ...(canDelete
                ? [
                      {
                          type: "divider" as const,
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
                  ]
                : []),
        ];
    };

    const columns = DEAL_TABLE_COLUMNS({
        actionItems: getActionItems,
        onAgentChange: handleAgentChange,
        canEdit: canEditDeal,
        t,
        td,
    });

    const valueLeadPipelineId = activePipelineId;

    const { persistPageSize } = usePersistedPageSize({
        storageKey: "hibarr_deals_per_page",
        currentPerPage: deals.per_page,
        onRestore: (perPage) =>
            router.get(
                route("deals.index"),
                mergeQueryParams({
                    lead_pipeline_id: valueLeadPipelineId,
                    page: 1,
                    per_page: perPage,
                    view,
                }),
                { only: ["deals"], preserveState: true, preserveScroll: true },
            ),
    });

    // Kanban view handlers
    const handleColumnsUpdate = useCallback((updatedColumns: BoardColumn[]) => {
        setBoardColumns(updatedColumns);
    }, []);

    const handleEditColumn = useCallback((columnId: number) => {
        // Column editing functionality - can be extended later
    }, []);

    const handleDeleteColumn = useCallback((columnId: number) => {
        // Column deletion functionality - can be extended later
    }, []);

    // ── Page-level refresh ──────────────────────────────────────────────
    const { refresh, isRefreshing } = usePageRefresh({
        onRefresh: async () => {
            // K3: view-aware partial reload — no full window.location.reload
            await new Promise<void>((resolve, reject) => {
                router.reload({
                    only: isKanbanView
                        ? ["deals", "boardColumns"]
                        : ["deals"],
                    onSuccess: () => resolve(),
                    onError: (errors) => reject(errors),
                });
            });

            if (isKanbanView) {
                await queryClient.invalidateQueries({
                    queryKey: [route("deals.kanban_deals")],
                });
            }
        },
    });

    return (
        <>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: t("app.deal") }]}
                searchComp={
                    <UniversalSearchBox
                        placeholder={t("app.deals.search_placeholder")}
                        className="w-full"
                    />
                }
            >
                <div
                    className="max-w-[1440px] mx-auto space-y-4"
                    style={{ fontFamily: REDESIGN_FONT_STACK }}
                >
                    <div
                        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-[10px] border px-4 py-3.5 bg-white"
                        style={{ borderColor: T.BORDER }}
                    >
                        <div className="flex items-center gap-2.5">
                            <PipelineSelector
                                pipelines={pipelines}
                                currentPipelineId={valueLeadPipelineId}
                                onSelect={handlePipelineChange}
                                allowAll
                                variant="chip"
                            />
                            <button
                                type="button"
                                className="dr-btn dr-btn-primary"
                                onClick={handleCreateDeal}
                            >
                                <PlusOutlined style={{ fontSize: 13 }} />
                                {t("app.deals.actions.add")}
                            </button>
                            <button
                                type="button"
                                className="dr-btn dr-btn-ghost"
                                onClick={handleImportDeals}
                            >
                                <ImportOutlined style={{ fontSize: 13 }} />
                                {t("app.import")}
                            </button>
                        </div>

                        <div className="flex items-center gap-2.5">
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
                                {activeFilterCount > 0 && (
                                    <span
                                        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-full text-[11px] font-semibold"
                                        style={{ background: T.BLUE, color: T.WHITE }}
                                    >
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>
                            <DealsModeSwitcher
                                view={view}
                                onChange={handleViewChange}
                            />
                        </div>
                    </div>

                    {/* Bulk actions — full-width bar below the toolbar, table view only. */}
                    {isTableView &&
                        (selectAllMatching || selectedEntities.length > 0) && (
                            <BulkDealActionSelector
                                selectedEntityIds={selectedEntities.map(
                                    ({ id }) => id,
                                )}
                                matchingTotal={deals.total}
                                selectAllMatching={selectAllMatching}
                                onSelectAllMatching={() =>
                                    setSelectAllMatching(true)
                                }
                                updateOptions={bulkUpdateOptions}
                                optionsLoading={formDataLoading}
                                clearSelected={clearSelected}
                            />
                        )}

                    {/* Quiet active-filter sentence */}
                    <ActiveFilterSentence
                        count={deals.total}
                        entityLabel="deals"
                        onOpenFilters={openDrawer}
                    />

                    {/* Table View */}
                    {isTableView && (
                        <DataTable<Deal>
                            columns={columns}
                            dataSource={deals.data}
                            rowKey="id"
                            rowSelection={rowSelection}
                            paginationData={{
                                current_page: deals.current_page,
                                last_page: deals.last_page,
                                per_page: deals.per_page,
                                total: deals.total,
                                from: deals.from,
                                to: deals.to,
                            }}
                            onPageChange={(page) => {
                                // X2: pagination only needs the deals list (table view only)
                                router.get(
                                    route("deals.index"),
                                    mergeQueryParams({
                                        lead_pipeline_id: valueLeadPipelineId,
                                        page,
                                        per_page: deals.per_page,
                                        view,
                                    }),
                                    {
                                        only: ["deals"],
                                        preserveState: true,
                                        preserveScroll: true,
                                    },
                                );
                            }}
                            onPageSizeChange={(pageSize) => {
                                persistPageSize(pageSize);
                                router.get(
                                    route("deals.index"),
                                    mergeQueryParams({
                                        lead_pipeline_id: valueLeadPipelineId,
                                        page: 1,
                                        per_page: pageSize,
                                        view,
                                    }),
                                    {
                                        only: ["deals"],
                                        preserveState: true,
                                        preserveScroll: true,
                                    },
                                );
                            }}
                            scroll={{ x: "max-content", y: "calc(100vh - 220px)" }}
                            size="small"
                        />
                    )}

                    {/* Kanban View */}
                    {isKanbanView && (
                        <div className="">
                            {showKanbanLoading ? (
                                <div className="flex items-center justify-center py-24">
                                    <Spin size="large" tip={td("Loading board…", { source: "en" })} />
                                </div>
                            ) : (
                                <KanbanBoard
                                    columns={boardColumns}
                                    td={td}
                                    addLeadPermission={addLeadPermission}
                                    onCreateDeal={handleCreateDeal}
                                    onEditDeal={handleEditDeal}
                                    onScheduleMeeting={handleScheduleMeeting}
                                    onAgentChange={handleAgentChange}
                                    onEditColumn={handleEditColumn}
                                    onDeleteColumn={handleDeleteColumn}
                                    onColumnsUpdate={handleColumnsUpdate}
                                    filters={{
                                        ...filters,
                                        lead_pipeline_id: valueLeadPipelineId,
                                    }}
                                />
                            )}
                        </div>
                    )}
                </div>
            </PageLayout>

            {/* Save Deal Modal - For Edit */}
            <SaveDealModal
                open={action === "edit"}
                onClose={handleClose}
                deal={deal}
                reloadKeys={
                    isKanbanView ? ["deals", "boardColumns"] : ["deals"]
                }
            />

            {/* Deal Gathering Form - For Add */}
            <DealInformationGatheringForm
                open={action === "add"}
                onClose={handleClose}
                deal={action === "edit" ? deal : null}
                // New deals always need a concrete pipeline, even while the
                // list is showing all of them.
                pipelineId={
                    valueLeadPipelineId === "all"
                        ? (defaultPipeline?.id ?? pipelines[0]?.id ?? 0)
                        : valueLeadPipelineId
                }
            />

            <DeleteDeal
                open={action === "delete"}
                onClose={() => handleClose()}
                deal={deal}
            />

            {/* Add Follow-up Modal */}
            {deal && (
                <AddFollowup
                    context="deal"
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

            {/* Two-pane filter workbench — shared with Leads */}
            <EntityFilterModal
                config={filterConfig}
                optionsLoading={formDataLoading}
                entityLabel="deals"
                currentCount={deals.total}
                savedViews={false}
            />
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
