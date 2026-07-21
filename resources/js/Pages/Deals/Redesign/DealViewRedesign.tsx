import PageLayout from "@/Components/PageLayout";
import usePageRefresh from "@/Hooks/usePageRefresh";
import { useEffect, useMemo, useState } from "react";
import { Deferred, usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
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
import useDealViewNavigation from "./hooks/useDealViewNavigation";
import useWorkspaceOverview from "./hooks/useWorkspaceOverview";
import useDealPipeline from "./hooks/useDealPipeline";
import { DealShowProps, DealTab } from "./types";
import "./deal-redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DealWorkspaceProvider, useDealWorkspace } from "./context/DealWorkspaceContext";

export default function DealViewRedesign(props: DealShowProps) {
    return (
        <DealWorkspaceProvider
            deal={props.deal}
            notes={props.notes}
            tasks={props.tasks}
            dealFollowUps={props.dealFollowUps}
            files={props.files}
        >
            <DealViewRedesignInner {...props} />
        </DealWorkspaceProvider>
    );
}

function DealViewRedesignInner(props: DealShowProps) {
    const [isDealEditMode] = useState(false);
    const [addTaskOpen, setAddTaskOpen] = useState(false);
    const [addMeetingOpen, setAddMeetingOpen] = useState(false);
    const [addNoteOpen, setAddNoteOpen] = useState(false);
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
    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !isDealEditMode,
    });
    const { deal, notes, tasks, dealFollowUps, files } = useDealWorkspace();
    const pageTitle = props?.pageTitle || deal?.name;
    const { t } = useTranslation();
    const { td } = useTd();

    const meetingTypes = props.meetingTypes ?? [];
    const permissions = props.permissions ?? {};
    const fields = props.fields ?? [];
    const customFieldCategories = props.customFieldCategories ?? [];
    // Already pipeline-filtered server-side (DealController@show) — scopes the
    // document slots to the categories this pipeline actually uses.
    const pipelineCategoryIds = useMemo(
        () =>
            customFieldCategories.map((category: { id: number }) =>
                Number(category.id),
            ),
        [customFieldCategories],
    );
    const employees = props.employees ?? [];
    const taskBoardColumns = props.taskBoardColumns ?? [];
    const dealPermissions = useDealPermissions(deal);

    // Wire the AI summary's ADVANCE_STAGE action to a real stage change (the
    // same mutation the pipeline stepper uses). Only actionable when the user
    // may change stages — otherwise the summary card renders it as advice, not
    // a dead button.
    const canChangeStages = permissions.change_deal_stages === "all";
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
        tabs.push("offers", "recommendations", "itinerary", "dealinfo", "timeline");
        return tabs;
    }, [permissions]);

    const activeTab = visibleTabs.includes(nav.tab) ? nav.tab : "overview";

    useEffect(() => {
        if (activeTab !== nav.tab) {
            nav.setTab(activeTab);
        }
    }, [activeTab, nav]);

    const counts = useMemo(
        () => ({
            notes: props.notes === undefined ? undefined : notes.length,
            tasks:
                props.tasks === undefined ? undefined : overview.openTasksCount,
            meetings:
                props.dealFollowUps === undefined
                    ? undefined
                    : overview.upcomingMeetingsCount,
            files: props.files === undefined ? undefined : files.length,
            offers: offersCount,
            recommendations: recommendationsCount,
            itinerary: deal.lead_flight_itineraries?.length ?? 0,
        }),
        [
            props.notes,
            props.tasks,
            props.dealFollowUps,
            props.files,
            notes.length,
            files.length,
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
            <DealAddTaskModal
                open={addTaskOpen}
                onClose={() => setAddTaskOpen(false)}
                dealId={deal.id}
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
                    />

                    <div className="">
                        <div className="mb-[14px]">
                            <DealPipelineStepper
                                deal={deal}
                                permissions={permissions}
                            />
                        </div>
                        <div className="dr-grid">
                            <div className="flex min-w-0 flex-col gap-[14px]">
                                {showAiSummary && (
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
                                )}

                                <section className="overflow-hidden rounded-xl border border-[#e2e5ea] bg-white">
                                    <DealTabBar
                                        activeTab={activeTab}
                                        counts={counts}
                                        visibleTabs={visibleTabs}
                                        onChange={nav.setTab}
                                    />
                                    <div className="p-4">
                                        {activeTab === "overview" && (
                                            <Deferred
                                                data={[
                                                    "notes",
                                                    "tasks",
                                                    "dealFollowUps",
                                                    "taskBoardColumns",
                                                ]}
                                                fallback={<OverviewDeferredSkeleton />}
                                            >
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
                                                    onAddMeeting={() => setAddMeetingOpen(true)}
                                                    onAddNote={() => setAddNoteOpen(true)}
                                                />
                                            </Deferred>
                                        )}
                                        {activeTab === "notes" && (
                                            <Deferred data="notes" fallback={<TabDeferredSkeleton />}>
                                                <WorkspaceNotesTab
                                                    notes={notes}
                                                    permissions={permissions}
                                                />
                                            </Deferred>
                                        )}
                                        {activeTab === "tasks" && (
                                            <Deferred
                                                data={["tasks", "taskBoardColumns"]}
                                                fallback={<TabDeferredSkeleton />}
                                            >
                                                <WorkspaceTasksTab
                                                    tasks={tasks}
                                                    taskBoardColumns={taskBoardColumns}
                                                    permissions={permissions}
                                                    onAddTask={() => setAddTaskOpen(true)}
                                                />
                                            </Deferred>
                                        )}
                                        {activeTab === "meetings" && (
                                            <Deferred
                                                data="dealFollowUps"
                                                fallback={<TabDeferredSkeleton />}
                                            >
                                                <WorkspaceMeetingsTab
                                                    deal={deal}
                                                    followUps={dealFollowUps}
                                                    meetingTypes={meetingTypes}
                                                    permissions={permissions}
                                                    onScheduleMeeting={() =>
                                                        setAddMeetingOpen(true)
                                                    }
                                                />
                                            </Deferred>
                                        )}
                                        {activeTab === "files" && (
                                            <Deferred data="files" fallback={<TabDeferredSkeleton />}>
                                                <WorkspaceFilesTab
                                                    deal={deal}
                                                    files={files}
                                                    permissions={permissions}
                                                    fields={fields}
                                                    categoryIds={pipelineCategoryIds}
                                                />
                                            </Deferred>
                                        )}
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
                                                canDelete={dealPermissions.canDelete}
                                            />
                                        )}
                                        {activeTab === "dealinfo" && (
                                            <DealInfoTab
                                                deal={deal}
                                                customFieldCategories={customFieldCategories}
                                                fields={fields}
                                                activeSection={nav.infoSection}
                                                onSectionChange={nav.setInfoSection}
                                                restrictPackageOrProperty={
                                                    props.restrictPackageOrProperty
                                                }
                                                consents={props.consents}
                                                gdprSetting={props.gdprSetting}
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

                            <div className="dr-dossier">
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
                                    onManagePackagesProperties={() =>
                                        nav.goToDealInfo("general")
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}
