import PageLayout from "@/Components/PageLayout";
import usePageRefresh from "@/Hooks/usePageRefresh";
import { useState } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import DealStickyHeader from "./components/header/DealStickyHeader";
import DealMainTabs from "./components/tabs/DealMainTabs";
import DealInfoTab from "./components/tabs/DealInfoTab";
import TimelineTab from "./components/tabs/TimelineTab";
import WorkspaceTab from "./components/workspace/WorkspaceTab";
import WorkspaceContextRail from "./components/workspace/rail/WorkspaceContextRail";
import DealAddTaskModal from "./components/workspace/DealAddTaskModal";
import DealScheduleMeetingModal from "./components/workspace/DealScheduleMeetingModal";
import useDealViewNavigation from "./hooks/useDealViewNavigation";
import useWorkspaceOverview from "./hooks/useWorkspaceOverview";
import { DealShowProps } from "./types";
import "./deal-redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

export default function DealViewRedesign(props: DealShowProps) {
    const [isDealEditMode] = useState(false);
    const [addTaskOpen, setAddTaskOpen] = useState(false);
    const [addMeetingOpen, setAddMeetingOpen] = useState(false);
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

    const overview = useWorkspaceOverview({
        notes: props.notes,
        tasks: props.tasks,
        dealFollowUps: props.dealFollowUps,
    });

    const upcomingTasks = overview.tasks.filter((task) => task.isOpen).slice(0, 5);
    const upcomingMeetings = overview.meetings
        .filter((meeting) => meeting.isUpcoming)
        .slice(0, 5);

    const switchToDealInfo = () => nav.switchToDealInfo("general");

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
                    />

                    <div className="p-[26px]">
                        <div className="dr-grid">
                            <div className="flex min-w-0 flex-col gap-[14px]">
                                {showAiSummary && (
                                    <EntityAiSummaryCard
                                        entityType="deal"
                                        entityId={props.deal.id}
                                        initialSummary={props.dealAiSummary}
                                        variant="redesign"
                                        onCreateTask={() =>
                                            nav.setWorkspaceSubTab("tasks")
                                        }
                                        onScheduleCall={() =>
                                            nav.setWorkspaceSubTab("meetings")
                                        }
                                        onRequestDocuments={() =>
                                            nav.setWorkspaceSubTab("files")
                                        }
                                        onReviewStaleDeal={() =>
                                            nav.setMainTab("timeline")
                                        }
                                    />
                                )}

                                <section className="overflow-hidden rounded-xl border border-[#e2e5ea] bg-white">
                                    <DealMainTabs
                                        mainTab={nav.mainTab}
                                        onChange={nav.setMainTab}
                                    />
                                    <div className="p-4">
                                        {nav.mainTab === "workspace" && (
                                            <WorkspaceTab
                                                deal={props.deal}
                                                notes={props.notes}
                                                tasks={props.tasks}
                                                dealFollowUps={props.dealFollowUps}
                                                files={props.files}
                                                meetingTypes={meetingTypes}
                                                taskBoardColumns={taskBoardColumns}
                                                permissions={permissions}
                                                activeSubTab={nav.workspaceSubTab}
                                                onChangeSubTab={nav.setWorkspaceSubTab}
                                                overview={overview}
                                                onAddTask={() => setAddTaskOpen(true)}
                                                onAddMeeting={() =>
                                                    setAddMeetingOpen(true)
                                                }
                                            />
                                        )}
                                        {nav.mainTab === "dealinfo" && (
                                            <DealInfoTab
                                                deal={props.deal}
                                                customFieldCategories={
                                                    customFieldCategories
                                                }
                                                fields={fields}
                                                activeSection={nav.infoSection}
                                                onSectionChange={nav.setInfoSection}
                                                restrictPackageOrProperty={
                                                    props.restrictPackageOrProperty
                                                }
                                            />
                                        )}
                                        {nav.mainTab === "timeline" && (
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
                                    upcomingTasks={
                                        props.tasks === undefined
                                            ? undefined
                                            : upcomingTasks
                                    }
                                    upcomingMeetings={
                                        props.dealFollowUps === undefined
                                            ? undefined
                                            : upcomingMeetings
                                    }
                                    restrictPackageOrProperty={
                                        props.restrictPackageOrProperty
                                    }
                                    onNavigateToSubTab={(tab) => {
                                        nav.setWorkspaceSubTab(tab);
                                    }}
                                    onSwitchToDealInfo={switchToDealInfo}
                                    onManagePackagesProperties={() =>
                                        nav.switchToDealInfo("property")
                                    }
                                    onAddTask={() => setAddTaskOpen(true)}
                                    onAddMeeting={() => setAddMeetingOpen(true)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}
