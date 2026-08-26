import PageLayout from "@/Components/PageLayout";
import usePageRefresh from "@/Hooks/usePageRefresh";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import ProductTour, { ProductTourHandle } from "@/Components/ProductTour/ProductTour";
import { DEAL_TOUR_ID, DEAL_TOUR_LABELS, buildDealTourSteps } from "./config/dealTourSteps";
import DealStickyHeader from "./components/header/DealStickyHeader";
import DealPipelineStepper from "./components/header/DealPipelineStepper";
import DealTabBar from "./components/tabs/DealTabBar";
import DealInfoTab from "./components/tabs/DealInfoTab";
import TimelineTab from "./components/tabs/TimelineTab";
import WorkspaceOverviewTab from "./components/workspace/WorkspaceOverviewTab";
import WorkspaceNotesTab from "./components/workspace/WorkspaceNotesTab";
import WorkspaceTasksTab from "./components/workspace/WorkspaceTasksTab";
import WorkspaceMeetingsTab from "./components/workspace/WorkspaceMeetingsTab";
import WorkspaceFilesTab from "./components/workspace/WorkspaceFilesTab";
import WorkspaceOffersTab from "./components/workspace/WorkspaceOffersTab";
import WorkspaceRecommendationsTab from "./components/workspace/WorkspaceRecommendationsTab";
import WorkspaceItineraryTab from "./components/workspace/WorkspaceItineraryTab";
import {
    OverviewDeferredSkeleton,
    TabDeferredSkeleton,
} from "./components/workspace/overview/overviewShared";
import WorkspaceContextRail from "./components/workspace/rail/WorkspaceContextRail";
import DealAddTaskModal from "./components/workspace/DealAddTaskModal";
import DealAddNoteModal from "./components/workspace/DealAddNoteModal";
import DealScheduleMeetingModal from "./components/workspace/DealScheduleMeetingModal";
import DealAnalysisModal from "./components/analysis/DealAnalysisModal";
import AnalysisStatusBanner from "./components/analysis/AnalysisStatusBanner";
import {
    buildScriptItems,
    computeAnalysisProgress,
} from "./components/analysis/analysisProgress";
import useDealAnalysis from "./hooks/useDealAnalysis";

import useDealViewNavigation from "./hooks/useDealViewNavigation";
import useWorkspaceOverview from "./hooks/useWorkspaceOverview";
import useDealPipeline from "./hooks/useDealPipeline";
import useDealDocuments from "./hooks/useDealDocuments";
import usePipelineHasPackages from "./hooks/usePipelineHasPackages";
import {
    filterCategoriesByScope,
    resolveScopedFieldKeys,
} from "@/Features/Deals/pipelineScopeUtils";
import { DealShowProps, DealTab } from "./types";
import "@/Components/Redesign/redesign.css";
import "./deal-redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import { setDealDateLocale } from "./adapters/dateFormat";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DealWorkspaceProvider, useDealWorkspace } from "./context/DealWorkspaceContext";

export default function DealViewRedesign(props: DealShowProps) {
    const { props: pageProps } = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? pageProps.featureFlags;
    const showOnlinePayment = featureFlags?.["packages.online-payment"] === true;

    return (
        <DealWorkspaceProvider deal={props.deal} paymentEnabled={showOnlinePayment}>
            <DealViewRedesignInner {...props} showOnlinePayment={showOnlinePayment} />
        </DealWorkspaceProvider>
    );
}

function DealViewRedesignInner(
    props: DealShowProps & { showOnlinePayment?: boolean },
) {
    const [isDealEditMode] = useState(false);
    const [addTaskOpen, setAddTaskOpen] = useState(false);
    const [addMeetingOpen, setAddMeetingOpen] = useState(false);
    const [addNoteOpen, setAddNoteOpen] = useState(false);
    const analysis = useDealAnalysis();
    // undefined = not yet known (tab not visited); the tab bar hides the
    // count pill until a real number is reported, instead of showing 0.
    const [offersCount, setOffersCount] = useState<number | undefined>(
        undefined,
    );
    const [recommendationsCount, setRecommendationsCount] = useState<
        number | undefined
    >(undefined);
    const nav = useDealViewNavigation();
    const { props: pageProps } = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? pageProps.featureFlags;
    const showAiSummary = featureFlags?.["sales.ai-entity-summary"] === true;
    const showCompletionDot =
        featureFlags?.["crm.deal-info-count-indicator"] === true;
    const showAnalysis = featureFlags?.["crm.deal-analysis"] === true;
    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !isDealEditMode,
    });
    const {
        deal,
        notes,
        notesLoading,
        tasks,
        tasksLoading,
        dealFollowUps,
        dealFollowUpsLoading,
        files,
        filesLoading,
    } = useDealWorkspace();
    const pageTitle = props?.pageTitle || deal?.name;
    const { t, locale } = useTranslation();
    // Adapters are plain functions with no hook access, so publish the active
    // locale once here; every date/time in the redesign reads it.
    setDealDateLocale(locale);
    const { td } = useTd();

    const meetingTypes = props.meetingTypes ?? [];
    const permissions = props.permissions ?? {};
    const fields = props.fields ?? [];
    const customFieldCategories = props.customFieldCategories ?? [];
    // NOT pipeline-filtered — this is the raw company-wide category list, kept
    // as-is here since it feeds the Files tab/context-rail document slots.
    const pipelineCategoryIds = useMemo(
        () =>
            customFieldCategories.map((category: { id: number }) =>
                Number(category.id),
            ),
        [customFieldCategories],
    );

    // Deal Info tab needs the actual pipeline/stage-scoped subset — mirrors
    // the legacy DealInfoSection.tsx pattern (pipelineScopeUtils.ts helpers).
    const pipelineCategoryScopeMap = pageProps.pipelineCategoryScopeMap ?? {};
    const pipelineFieldScopeMap = pageProps.pipelineFieldScopeMap ?? {};
    const hideAllCategoriesPipelineIds =
        pageProps.hideAllCategoriesPipelineIds ?? [];
    const stages = pageProps.stages ?? [];
    const scopedCategoryIdsFromServer =
        pageProps.scopedCustomFieldCategoryIds ?? null;
    const scopedDealFieldKeysFromServer = pageProps.visibleDealFieldKeys as
        | string[]
        | null
        | undefined;

    const dealInfoCategories = useMemo(
        () =>
            filterCategoriesByScope(
                customFieldCategories,
                pipelineCategoryScopeMap,
                deal.lead_pipeline_id,
                deal.pipeline_stage_id,
                stages,
                scopedCategoryIdsFromServer,
                hideAllCategoriesPipelineIds,
            ),
        [
            customFieldCategories,
            pipelineCategoryScopeMap,
            deal.lead_pipeline_id,
            deal.pipeline_stage_id,
            stages,
            scopedCategoryIdsFromServer,
            hideAllCategoriesPipelineIds,
        ],
    );

    // Analysis progress off saved values, so the status card reports the same
    // totals as the modal header. Recomputed when the deal reloads on modal close.
    const analysisProgress = useMemo(
        () =>
            computeAnalysisProgress(
                buildScriptItems(props.analysisScript, dealInfoCategories),
                fields,
                {
                    ...(deal.custom_fields_data ?? {}),
                    ...((pageProps.leadCustomFieldsData as Record<string, any>) ?? {}),
                },
                deal,
            ),
        [props.analysisScript, dealInfoCategories, fields, deal, pageProps.leadCustomFieldsData],
    );

    const dealInfoFieldKeys = useMemo(
        () =>
            scopedDealFieldKeysFromServer !== undefined
                ? scopedDealFieldKeysFromServer
                : resolveScopedFieldKeys(
                      pipelineFieldScopeMap,
                      "App\\Models\\Deal",
                      deal.lead_pipeline_id,
                      deal.pipeline_stage_id,
                      stages,
                  ),
        [
            scopedDealFieldKeysFromServer,
            pipelineFieldScopeMap,
            deal.lead_pipeline_id,
            deal.pipeline_stage_id,
            stages,
        ],
    );
    const employees = props.employees ?? [];
    const taskBoardColumns = props.taskBoardColumns ?? [];
    const dealPermissions = useDealPermissions(deal);
    const pipelineHasPackages = usePipelineHasPackages();
    const tourRef = useRef<ProductTourHandle>(null);
    const dealTourSteps = useMemo(
        () => buildDealTourSteps(nav.setTab),
        [nav.setTab],
    );

    // Wire the AI summary's ADVANCE_STAGE action to a real stage change (the
    // same mutation the pipeline stepper uses). Only actionable when the user
    // may change stages — otherwise the summary card renders it as advice, not
    // a dead button.
    const canChangeStages = permissions.change_deal_stages === "all";
    const canManagePayments = permissions.edit_payments === "all";
    const pipeline = useDealPipeline(deal, canChangeStages);
    const advanceToNextStage = useMemo(() => {
        if (!canChangeStages) return undefined;
        const ordered = [...pipeline.stages].sort(
            (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
        );
        const currentIndex = ordered.findIndex(
            (stage) => stage.id === pipeline.currentStageId,
        );
        const next = ordered[currentIndex + 1];
        if (!next) return undefined;
        return () => pipeline.updateStage(next.id);
    }, [canChangeStages, pipeline]);

    const overview = useWorkspaceOverview({
        notes,
        tasks,
        dealFollowUps,
    });

    const visibleTabs = useMemo(() => {
        const tabs: DealTab[] = ["overview"];
        if (permissions.view_deal_note !== "none") tabs.push("notes");
        if (permissions.view_tasks !== "none") tabs.push("tasks");
        if (permissions.view_lead_follow_up !== "none") tabs.push("meetings");
        if (permissions.view_lead_files !== "none") tabs.push("files");
        // Offers and recommendations are both property-led, so a package
        // pipeline drops them (see usePipelineHasPackages).
        if (permissions.view_lead_proposals !== "none" && !pipelineHasPackages) {
            tabs.push("offers");
        }
        if (!pipelineHasPackages) tabs.push("recommendations");
        // itinerary / dealinfo / timeline have no matching permission in this
        // system, so they follow deal visibility itself.
        // Note `view_events` is the calendar module, not the CRM timeline.
        tabs.push("itinerary", "dealinfo", "timeline");
        return tabs;
    }, [permissions, pipelineHasPackages]);

    const activeTab = visibleTabs.includes(nav.tab) ? nav.tab : "overview";

    useEffect(() => {
        if (activeTab !== nav.tab) {
            nav.setTab(activeTab);
        }
    }, [activeTab, nav]);

    // Badge must count the same thing the Files tab body renders — document
    // slots (HIBARR/custom file fields) plus loose attachments, deduped — not
    // just the raw loose-attachment list, or the badge can read 0 while the
    // tab shows every uploaded document.
    const { documents: fileDocuments } = useDealDocuments(
        deal,
        files,
        fields,
        pipelineCategoryIds,
    );

    const counts = useMemo(
        () => ({
            notes: notesLoading ? undefined : notes.length,
            tasks: tasksLoading ? undefined : overview.openTasksCount,
            meetings: dealFollowUpsLoading
                ? undefined
                : overview.upcomingMeetingsCount,
            files: filesLoading
                ? undefined
                : fileDocuments.filter((doc) => doc.uploaded).length,
            offers: offersCount,
            recommendations: recommendationsCount,
            itinerary: deal.lead_flight_itineraries?.length ?? 0,
        }),
        [
            notesLoading,
            tasksLoading,
            dealFollowUpsLoading,
            filesLoading,
            notes.length,
            fileDocuments,
            deal.lead_flight_itineraries?.length,
            overview.openTasksCount,
            overview.upcomingMeetingsCount,
            offersCount,
            recommendationsCount,
        ],
    );

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: t("app.menu.dashboard"), url: route("dashboard") },
                {
                    name: t("pages.deals.header.breadcrumb_deals"),
                    url: route("deals.index"),
                },
                { name: td(pageTitle) },
            ]}
        >
            {showAnalysis && (
                <DealAnalysisModal
                    analysis={analysis}
                    dealInfoCategories={dealInfoCategories}
                    fields={fields}
                    visibleLeadFieldKeys={props.visibleLeadFieldKeys}
                    analysisScript={props.analysisScript}
                    onAddTask={() => setAddTaskOpen(true)}
                    onScheduleMeeting={() => setAddMeetingOpen(true)}
                />
            )}
            <DealAddTaskModal
                open={addTaskOpen}
                onClose={() => setAddTaskOpen(false)}
                dealId={deal.id}
                dealAgentUserId={
                    deal.lead_agent?.user?.id ??
                    deal.lead_agent?.user_id ??
                    deal.agent?.user?.id ??
                    deal.agent?.user_id ??
                    null
                }
            />
            <DealScheduleMeetingModal
                open={addMeetingOpen}
                onClose={() => setAddMeetingOpen(false)}
                deal={deal}
                meetingTypes={meetingTypes}
            />
            <DealAddNoteModal
                open={addNoteOpen}
                onClose={() => setAddNoteOpen(false)}
                dealId={deal.id}
            />
            <ProductTour
                ref={tourRef}
                tourId={DEAL_TOUR_ID}
                steps={dealTourSteps}
                labels={DEAL_TOUR_LABELS}
            />

            <div className="deal-redesign min-h-screen bg-[#f5f6f8]">
                <div className="mx-auto flex flex-col gap-4 w-full max-w-[1320px]">
                    <DealStickyHeader
                        deal={deal}
                        permissions={permissions}
                        employees={employees}
                        isRefreshing={isRefreshing}
                        onRefresh={refresh}
                        onAddNote={() => setAddNoteOpen(true)}
                        onAddTask={() => setAddTaskOpen(true)}
                        onScheduleMeeting={() => setAddMeetingOpen(true)}
                        onOpenAnalysis={showAnalysis ? analysis.open : undefined}
                        onReplayGuide={() => tourRef.current?.restart()}
                    />

                    <div className="">
                        <div className="mb-[14px] flex items-stretch gap-4" data-tour="deal-pipeline-stepper">
                            <div className="min-w-0 flex-1">
                                <DealPipelineStepper
                                    deal={deal}
                                    permissions={permissions}
                                    onGoToField={({ section, fieldKey }) => {
                                        nav.goToDealInfo(section);
                                        // Highlight after the info tab + section mount.
                                        // Custom fields need a bit longer; retry a few times.
                                        const selectors = [
                                            `[data-deal-field="${CSS.escape(fieldKey)}"]`,
                                            `[data-field-key="${CSS.escape(fieldKey)}"]`,
                                        ];
                                        // custom_field_12 ↔ field_12 aliasing
                                        if (
                                            fieldKey.startsWith("custom_field_")
                                        ) {
                                            const id = fieldKey.replace(
                                                "custom_field_",
                                                "",
                                            );
                                            selectors.push(
                                                `[data-field-key="field_${CSS.escape(id)}"]`,
                                                `[data-deal-field="field_${CSS.escape(id)}"]`,
                                            );
                                        } else if (
                                            fieldKey.startsWith("field_")
                                        ) {
                                            const id = fieldKey.replace(
                                                "field_",
                                                "",
                                            );
                                            selectors.push(
                                                `[data-deal-field="custom_field_${CSS.escape(id)}"]`,
                                            );
                                        }

                                        let attempts = 0;
                                        const tryHighlight = () => {
                                            attempts += 1;
                                            let el: Element | null = null;
                                            for (const sel of selectors) {
                                                el = document.querySelector(sel);
                                                if (el) break;
                                            }
                                            if (el instanceof HTMLElement) {
                                                el.scrollIntoView({
                                                    behavior: "smooth",
                                                    block: "center",
                                                });
                                                el.classList.add(
                                                    "deal-field-flash",
                                                );
                                                window.setTimeout(
                                                    () =>
                                                        el?.classList.remove(
                                                            "deal-field-flash",
                                                        ),
                                                    1800,
                                                );
                                                return;
                                            }
                                            if (attempts < 12) {
                                                window.setTimeout(
                                                    tryHighlight,
                                                    80,
                                                );
                                            }
                                        };
                                        window.setTimeout(tryHighlight, 60);
                                    }}
                                />
                            </div>
                            {showAnalysis && (
                                <AnalysisStatusBanner
                                    analysis={analysis}
                                    totalFilled={analysisProgress.totalFilled}
                                    totalFields={analysisProgress.totalFields}
                                />
                            )}
                        </div>
                        <div className="dr-grid">
                            <div className="flex min-w-0 flex-col gap-[14px]">
                                {showAiSummary && (
                                    <div data-tour="deal-ai-summary">
                                        <EntityAiSummaryCard
                                            entityType="deal"
                                            entityId={deal.id}
                                            initialSummary={props.dealAiSummary}
                                            variant="redesign"
                                            // Executable actions perform the real
                                            // thing (open the modal / advance the
                                            // stage), not just switch tabs.
                                            onCreateTask={() => setAddTaskOpen(true)}
                                            onScheduleCall={() => setAddMeetingOpen(true)}
                                            onRequestDocuments={() => nav.setTab("files")}
                                            onReviewStaleDeal={() => nav.setTab("timeline")}
                                            onAdvanceStage={advanceToNextStage}
                                        />
                                    </div>
                                )}

                                <section className="overflow-hidden rounded-xl border border-[#e2e5ea] bg-white">
                                    <div data-tour="deal-tabs">
                                        <DealTabBar
                                            activeTab={activeTab}
                                            counts={counts}
                                            visibleTabs={visibleTabs}
                                            onChange={nav.setTab}
                                        />
                                    </div>
                                    <div className="p-4">
                                        {activeTab === "overview" &&
                                            ((notesLoading && notes.length === 0) ||
                                            (tasksLoading && tasks.length === 0) ||
                                            (dealFollowUpsLoading &&
                                                dealFollowUps.length === 0) ? (
                                                <OverviewDeferredSkeleton />
                                            ) : (
                                                <div data-tour="deal-overview">
                                                    <WorkspaceOverviewTab
                                                        deal={deal}
                                                        notes={notes}
                                                        tasks={tasks}
                                                        dealFollowUps={dealFollowUps}
                                                        taskBoardColumns={taskBoardColumns}
                                                        permissions={permissions}
                                                        meetingTypes={meetingTypes}
                                                        onNavigateToSubTab={nav.setTab}
                                                        onAddTask={() => setAddTaskOpen(true)}
                                                        onAddMeeting={() =>
                                                            setAddMeetingOpen(true)
                                                        }
                                                        onAddNote={() => setAddNoteOpen(true)}
                                                    />
                                                </div>
                                            ))}
                                        {activeTab === "notes" &&
                                            (notesLoading && notes.length === 0 ? (
                                                <TabDeferredSkeleton />
                                            ) : (
                                                <WorkspaceNotesTab
                                                    notes={notes}
                                                    permissions={permissions}
                                                    onAddNote={() => setAddNoteOpen(true)}
                                                />
                                            ))}
                                        {activeTab === "tasks" &&
                                            (tasksLoading && tasks.length === 0 ? (
                                                <TabDeferredSkeleton />
                                            ) : (
                                                <WorkspaceTasksTab
                                                    tasks={tasks}
                                                    taskBoardColumns={taskBoardColumns}
                                                    permissions={permissions}
                                                    onAddTask={() => setAddTaskOpen(true)}
                                                />
                                            ))}
                                        {activeTab === "meetings" &&
                                            (dealFollowUpsLoading &&
                                            dealFollowUps.length === 0 ? (
                                                <TabDeferredSkeleton />
                                            ) : (
                                                <WorkspaceMeetingsTab
                                                    deal={deal}
                                                    followUps={dealFollowUps}
                                                    meetingTypes={meetingTypes}
                                                    permissions={permissions}
                                                    onScheduleMeeting={() =>
                                                        setAddMeetingOpen(true)
                                                    }
                                                />
                                            ))}
                                        {activeTab === "files" &&
                                            (filesLoading && files.length === 0 ? (
                                                <TabDeferredSkeleton />
                                            ) : (
                                                <WorkspaceFilesTab
                                                    deal={deal}
                                                    files={files}
                                                    permissions={permissions}
                                                    fields={fields}
                                                    categoryIds={pipelineCategoryIds}
                                                />
                                            ))}
                                        {activeTab === "offers" && (
                                            <WorkspaceOffersTab
                                                deal={deal}
                                                onCountChange={setOffersCount}
                                            />
                                        )}
                                        {activeTab === "recommendations" && (
                                            <WorkspaceRecommendationsTab
                                                deal={deal}
                                                permissions={permissions}
                                                restrictPackageOrProperty={
                                                    props.restrictPackageOrProperty
                                                }
                                                onCountChange={setRecommendationsCount}
                                            />
                                        )}
                                        {activeTab === "itinerary" && (
                                            <WorkspaceItineraryTab
                                                deal={deal}
                                                canAdd={dealPermissions.canEdit}
                                                canDelete={dealPermissions.canEdit}
                                            />
                                        )}
                                        {activeTab === "dealinfo" && (
                                            <DealInfoTab
                                                deal={deal}
                                                customFieldCategories={dealInfoCategories}
                                                visibleFieldKeys={dealInfoFieldKeys}
                                                fields={fields}
                                                activeSection={nav.infoSection}
                                                onSectionChange={nav.setInfoSection}
                                                restrictPackageOrProperty={
                                                    props.restrictPackageOrProperty
                                                }
                                                consents={props.consents}
                                                gdprSetting={props.gdprSetting}
                                                showCompletionDot={showCompletionDot}
                                            />
                                        )}
                                        {activeTab === "timeline" && (
                                            <TimelineTab
                                                dealId={deal.id}
                                                dealName={deal.name}
                                                userId={props.auth?.user?.id}
                                            />
                                        )}
                                    </div>
                                </section>
                            </div>

                            <div className="dr-dossier" data-tour="deal-dossier">
                                <WorkspaceContextRail
                                    deal={deal}
                                    files={files}
                                    fields={fields}
                                    categoryIds={pipelineCategoryIds}
                                    restrictPackageOrProperty={
                                        props.restrictPackageOrProperty
                                    }
                                    onNavigateToSubTab={nav.setTab}
                                    onSwitchToDealInfo={() => nav.goToDealInfo("general")}
                                    showOnlinePayment={props.showOnlinePayment}
                                    canManagePayments={canManagePayments}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}
