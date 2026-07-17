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
import DealScheduleMeetingModal from "./components/workspace/DealScheduleMeetingModal";
import useDealViewNavigation from "./hooks/useDealViewNavigation";
import useWorkspaceOverview from "./hooks/useWorkspaceOverview";
import { DealShowProps, DealTab } from "./types";
import "./deal-redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

export default function DealViewRedesign(props: DealShowProps) {
    const [isDealEditMode] = useState(false);
    const [addTaskOpen, setAddTaskOpen] = useState(false);
    const [addMeetingOpen, setAddMeetingOpen] = useState(false);
    const [offersCount, setOffersCount] = useState(0);
    const [recommendationsCount, setRecommendationsCount] = useState(0);
    const nav = useDealViewNavigation();
    const { props: pageProps } = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? pageProps.featureFlags;
    const showAiSummary = featureFlags?.["sales.ai-entity-summary"] === true;
    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !isDealEditMode,
    });
    const pageTitle = props?.pageTitle || props?.deal?.name;
    const { t } = useTranslation();
    const { td } = useTd();

    const meetingTypes = props.meetingTypes ?? [];
    const permissions = props.permissions ?? {};
    const fields = props.fields ?? [];
    const customFieldCategories = props.customFieldCategories ?? [];
    const employees = props.employees ?? [];
    const taskBoardColumns = props.taskBoardColumns ?? [];
    const dealPermissions = useDealPermissions(props.deal);

    const overview = useWorkspaceOverview({
        notes: props.notes,
        tasks: props.tasks,
        dealFollowUps: props.dealFollowUps,
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
            notes: props.notes === undefined ? undefined : props.notes.length,
            tasks:
                props.tasks === undefined ? undefined : overview.openTasksCount,
            meetings:
                props.dealFollowUps === undefined
                    ? undefined
                    : overview.upcomingMeetingsCount,
            files: props.files === undefined ? undefined : props.files.length,
            offers: offersCount,
            recommendations: recommendationsCount,
            itinerary: props.deal.lead_flight_itineraries?.length ?? 0,
        }),
        [
            props.notes,
            props.tasks,
            props.dealFollowUps,
            props.files,
            props.deal.lead_flight_itineraries?.length,
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
                { name: td("Deals"), url: route("deals.index") },
                { name: td(pageTitle) },
            ]}
        >
            <DealAddTaskModal
                open={addTaskOpen}
                onClose={() => setAddTaskOpen(false)}
                dealId={props.deal.id}
            />
            <DealScheduleMeetingModal
                open={addMeetingOpen}
                onClose={() => setAddMeetingOpen(false)}
                deal={props.deal}
                meetingTypes={meetingTypes}
            />

            <div className="deal-redesign min-h-screen bg-[#f5f6f8]">
                <div className="mx-auto w-full max-w-[1320px]">
                    <DealStickyHeader
                        deal={props.deal}
                        permissions={permissions}
                        employees={employees}
                        isRefreshing={isRefreshing}
                        onRefresh={refresh}
                        onAddNote={() => nav.setTab("notes")}
                        onAddTask={() => setAddTaskOpen(true)}
                        onScheduleMeeting={() => setAddMeetingOpen(true)}
                    />

                    <div className="p-[26px]">
                        <div className="mb-[14px]">
                            <DealPipelineStepper
                                deal={props.deal}
                                permissions={permissions}
                            />
                        </div>
                        <div className="dr-grid">
                            <div className="flex min-w-0 flex-col gap-[14px]">
                                {showAiSummary && (
                                    <EntityAiSummaryCard
                                        entityType="deal"
                                        entityId={props.deal.id}
                                        initialSummary={props.dealAiSummary}
                                        variant="redesign"
                                        onCreateTask={() => nav.setTab("tasks")}
                                        onScheduleCall={() => nav.setTab("meetings")}
                                        onRequestDocuments={() => nav.setTab("files")}
                                        onReviewStaleDeal={() => nav.setTab("timeline")}
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
                                                    deal={props.deal}
                                                    notes={props.notes ?? []}
                                                    tasks={props.tasks ?? []}
                                                    dealFollowUps={props.dealFollowUps ?? []}
                                                    taskBoardColumns={taskBoardColumns}
                                                    onNavigateToSubTab={nav.setTab}
                                                    onAddTask={() => setAddTaskOpen(true)}
                                                    onAddMeeting={() => setAddMeetingOpen(true)}
                                                />
                                            </Deferred>
                                        )}
                                        {activeTab === "notes" && (
                                            <Deferred data="notes" fallback={<TabDeferredSkeleton />}>
                                                <WorkspaceNotesTab
                                                    deal={props.deal}
                                                    notes={props.notes ?? []}
                                                    permissions={permissions}
                                                    onAttachFiles={() => nav.setTab("files")}
                                                />
                                            </Deferred>
                                        )}
                                        {activeTab === "tasks" && (
                                            <Deferred
                                                data={["tasks", "taskBoardColumns"]}
                                                fallback={<TabDeferredSkeleton />}
                                            >
                                                <WorkspaceTasksTab
                                                    tasks={props.tasks ?? []}
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
                                                    deal={props.deal}
                                                    followUps={props.dealFollowUps ?? []}
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
                                                    deal={props.deal}
                                                    files={props.files ?? []}
                                                    permissions={permissions}
                                                />
                                            </Deferred>
                                        )}
                                        {activeTab === "offers" && (
                                            <WorkspaceOffersTab
                                                deal={props.deal}
                                                onCountChange={setOffersCount}
                                            />
                                        )}
                                        {activeTab === "recommendations" && (
                                            <WorkspaceRecommendationsTab
                                                deal={props.deal}
                                                permissions={permissions}
                                                onCountChange={setRecommendationsCount}
                                            />
                                        )}
                                        {activeTab === "itinerary" && (
                                            <WorkspaceItineraryTab
                                                deal={props.deal}
                                                canAdd={dealPermissions.canEdit}
                                                canDelete={dealPermissions.canDelete}
                                            />
                                        )}
                                        {activeTab === "dealinfo" && (
                                            <DealInfoTab
                                                deal={props.deal}
                                                customFieldCategories={customFieldCategories}
                                                fields={fields}
                                                activeSection={nav.infoSection}
                                                onSectionChange={nav.setInfoSection}
                                                restrictPackageOrProperty={
                                                    props.restrictPackageOrProperty
                                                }
                                            />
                                        )}
                                        {activeTab === "timeline" && (
                                            <TimelineTab
                                                dealId={props.deal.id}
                                                dealName={props.deal.name}
                                                userId={props.auth?.user?.id}
                                            />
                                        )}
                                    </div>
                                </section>
                            </div>

                            <div className="dr-dossier">
                                <WorkspaceContextRail
                                    deal={props.deal}
                                    files={props.files}
                                    fields={fields}
                                    restrictPackageOrProperty={
                                        props.restrictPackageOrProperty
                                    }
                                    onNavigateToSubTab={nav.setTab}
                                    onSwitchToDealInfo={() => nav.goToDealInfo("general")}
                                    onManagePackagesProperties={() =>
                                        nav.goToDealInfo("property")
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
