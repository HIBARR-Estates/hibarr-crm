import DealInformationGatheringForm from "@/Features/Deals/DealInformationGathering/DealInformationGatheringForm";
import SaveDealModal from "@/Features/Deals/SaveDeal/SaveDealModal";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import BulkDealActionSelector from "@/Features/Deals/BulkActions/BulkDealActionSelector";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import usePageSort from "@/Hooks/usePageSort";
import useViewPreference from "@/Hooks/useViewPreference";
import { LeadCategory, LeadSource } from "@/Types/api/leads";
import { PipelineStage } from "@/Types/api/deals";
import ContextualActiveFilters from "@/Components/ContextualActiveFilters";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import createDealFilterConfig from "@/configs/dealFilterConfig";
import { createDealSearchConfig } from "@/configs/searchConfigs";
import { getDealPermissions } from "@/Hooks/useDealPermissions";
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
import { Button, MenuProps, Select } from "antd";
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

interface Package {
    id: number;
    name: string;
}

export interface IndexProps extends PageProps {
    pageTitle: string;
    deals: PaginatedDealResponse;
    boardColumns: BoardColumn[];
    categories: LeadCategory[];
    sources: LeadSource[];
    stages: PipelineStage[];
    leadAgents: LeadAgent[];
    employees: User[];
    countries: Array<{ iso: string; nicename: string; iso3: string }>;
    salutations: Array<{ value: string; label: string }>;
    pipelines: Pipeline[];
    packages: Package[];
    addLeadPermission?: string;
}

const Index = ({
    pageTitle,
    deals,
    boardColumns: initialBoardColumns,
    stages,
    leadAgents,
    pipelines,
    packages,
    sources,
    defaultPipeline,
    addLeadPermission = "all",
    ...props
}: IndexProps) => {
    const { t } = useTranslation();

    // Get current user and permissions for deal permission checks
    const { props: pageProps } = usePage<any>();
    const currentUser = pageProps.auth?.user;
    const editDealsPermission = pageProps.auth?.permissions?.edit_deals;
    const { td } = useTd();

    const queryClient = useQueryClient();

    // View mode state: table or kanban (persisted in localStorage)
    const { view, setView, isTableView, isKanbanView } = useViewPreference({
        storageKey: "deals",
        defaultView: "table",
    });

    // Board columns state for kanban view
    const [boardColumns, setBoardColumns] =
        useState<BoardColumn[]>(initialBoardColumns);

    // Update board columns when props change
    React.useEffect(() => {
        setBoardColumns(initialBoardColumns);
    }, [initialBoardColumns]);

    const {
        handleAction,
        handleClose,
        action,
        selected: deal,
    } = useGenericEntityAction<Deal>();

    // Memoize configs to prevent unnecessary re-renders and filter resets
    const filterConfig = useMemo(
        () =>
            createDealFilterConfig({
                ...props,
                stages,
                leadPipelines: pipelines,
                leadAgents,
                sources,
                packages,
                excludeFields: [
                    "pipeline_stage_id",
                    "lead_pipeline_id",
                    "search",
                ],
            }),
        [
            props.categories,
            (props as any).leadPipelines,
            stages,
            leadAgents,
            props.employees,
            pipelines,
            sources,
            packages,
        ],
    );

    // Setup search and filter contexts
    const { filter } = usePageSearchAndFilter({
        filterConfig,
    });

    // Extract commonly used values
    const { openDrawer, filters } = filter;

    const handlePipelineChange = (value: number) => {
        // Get current params
        const urlParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlParams.entries());

        // Update pipeline
        params.lead_pipeline_id = String(value);

        // Navigate
        router.get(route("deals.index"), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

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
                        router.reload({ only: ["deals", "boardColumns"] });
                    },
                },
            );
        },
        [changeAgent],
    );

    // Helper to check if user can edit a specific deal
    const canEditDeal = useCallback(
        (deal: Deal): boolean => {
            const { canEdit } = getDealPermissions(
                deal,
                currentUser?.id,
                editDealsPermission,
            );
            return canEdit;
        },
        [currentUser?.id, editDealsPermission],
    );

    // Action dropdown for each row - respects deal permissions (watchers can't edit/delete)
    const getActionItems = (record: Deal): MenuProps["items"] => {
        // Get permissions for this specific deal
        const { canEdit, canDelete } = getDealPermissions(
            record,
            currentUser?.id,
            editDealsPermission,
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

    const valueLeadPipelineId = (props as any).filters?.lead_pipeline_id
        ? Number((props as any).filters?.lead_pipeline_id)
        : defaultPipeline?.id;

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
            // Reload Inertia server-rendered props (deals table data + board columns)
            await new Promise<void>((resolve, reject) => {
                router.reload({
                    onSuccess: () => resolve(),
                    onError: (errors) => reject(errors),
                });
            });

            // For Kanban view, also bust the React Query cache that each
            // KanbanColumn uses via useApiInfiniteQuery.
            if (isKanbanView) {
                window.location.reload(); // Full reload to ensure all Kanban data is fresh and in sync
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
                filterSection={<ContextualActiveFilters />}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <PipelineSelector
                                pipelines={pipelines}
                                currentPipelineId={valueLeadPipelineId}
                                onSelect={handlePipelineChange}
                            />
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleCreateDeal}
                            >
                                {t("app.deals.actions.add")}
                            </Button>
                            <Button
                                type="text"
                                icon={<ImportOutlined />}
                                onClick={handleImportDeals}
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
                                {td("Refresh")}
                            </Button>
                            {/* Advanced Filters Button */}
                            <div className="flex items-center gap-x-2">
                                <Button
                                    icon={<FilterOutlined />}
                                    onClick={openDrawer}
                                >
                                    {t("app.filter")}
                                </Button>
                                <DealsModeSwitcher
                                    view={view}
                                    onChange={setView}
                                />
                            </div>

                            {/* Bulk Actions - Only show when items are selected (table view only) */}
                            {isTableView && selectedEntities.length > 0 && (
                                <BulkDealActionSelector
                                    selectedEntityIds={selectedEntities?.map(
                                        ({ id }) => id,
                                    )}
                                    stages={stages}
                                    leadAgents={leadAgents}
                                    clearSelected={clearSelected}
                                />
                            )}
                        </div>
                    </div>

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
                                router.get(
                                    route("deals.index"),
                                    {
                                        ...filters,
                                        lead_pipeline_id: valueLeadPipelineId,
                                        ...sortParams,
                                        page,
                                        per_page: deals.per_page,
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
                    )}

                    {/* Kanban View */}
                    {isKanbanView && (
                        <div className="">
                            {/* <div className="bg-white rounded-lg border border-gray-200 p-4"> */}
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
                        </div>
                    )}
                </div>
            </PageLayout>

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

            {/* Universal Filter Drawer */}
            <UniversalFilterDrawer config={filterConfig} />
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
