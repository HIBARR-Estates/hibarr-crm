import { useEffect, useMemo, useState } from "react";
import { Deferred } from "@inertiajs/react";

import { useDealPermissions } from "@/Hooks/useDealPermissions";
import useWorkspaceOverview from "../../hooks/useWorkspaceOverview";
import { DealShowProps, WorkspaceSubTab } from "../../types";
import WorkspaceOverviewTab from "./WorkspaceOverviewTab";
import WorkspaceSubTabBar from "./WorkspaceSubTabBar";
import WorkspaceNotesTab from "./WorkspaceNotesTab";
import WorkspaceTasksTab from "./WorkspaceTasksTab";
import WorkspaceMeetingsTab from "./WorkspaceMeetingsTab";
import WorkspaceFilesTab from "./WorkspaceFilesTab";
import WorkspaceOffersTab from "./WorkspaceOffersTab";
import WorkspaceRecommendationsTab from "./WorkspaceRecommendationsTab";
import WorkspaceItineraryTab from "./WorkspaceItineraryTab";
import {
    OverviewDeferredSkeleton,
    TabDeferredSkeleton,
} from "./overview/overviewShared";

interface WorkspaceTabProps
    extends Pick<
        DealShowProps,
        | "deal"
        | "notes"
        | "tasks"
        | "dealFollowUps"
        | "files"
        | "meetingTypes"
        | "taskBoardColumns"
        | "permissions"
    > {
    activeSubTab: WorkspaceSubTab;
    onChangeSubTab: (tab: WorkspaceSubTab) => void;
    overview: ReturnType<typeof useWorkspaceOverview>;
    onAddTask: () => void;
    onAddMeeting: () => void;
}

export default function WorkspaceTab({
    deal,
    notes,
    tasks,
    dealFollowUps,
    files,
    meetingTypes = [],
    taskBoardColumns = [],
    permissions = {},
    activeSubTab,
    onChangeSubTab,
    overview,
    onAddTask,
    onAddMeeting,
}: WorkspaceTabProps) {
    const [recommendationsCount, setRecommendationsCount] = useState(0);
    const [offersCount, setOffersCount] = useState(0);
    const dealPermissions = useDealPermissions(deal);

    const subTabs = useMemo(() => {
        const tabs: WorkspaceSubTab[] = ["overview"];
        if (permissions.view_deal_note !== "none") tabs.push("notes");
        if (permissions.view_tasks !== "none") tabs.push("tasks");
        if (permissions.view_lead_follow_up !== "none") tabs.push("meetings");
        if (permissions.view_lead_files !== "none") tabs.push("files");
        tabs.push("offers", "recommendations", "itinerary");
        return tabs;
    }, [permissions]);

    const effectiveSubTab = subTabs.includes(activeSubTab)
        ? activeSubTab
        : "overview";

    useEffect(() => {
        if (effectiveSubTab !== activeSubTab) {
            onChangeSubTab(effectiveSubTab);
        }
    }, [activeSubTab, effectiveSubTab, onChangeSubTab]);

    const counts = useMemo(
        () => ({
            notes: notes === undefined ? undefined : notes.length,
            tasks: tasks === undefined ? undefined : overview.openTasksCount,
            meetings:
                dealFollowUps === undefined
                    ? undefined
                    : overview.upcomingMeetingsCount,
            files: files === undefined ? undefined : files.length,
            offers: offersCount,
            recommendations: recommendationsCount,
            itinerary: deal.lead_flight_itineraries?.length ?? 0,
        }),
        [
            dealFollowUps,
            deal.lead_flight_itineraries?.length,
            files,
            notes,
            offersCount,
            overview.openTasksCount,
            overview.upcomingMeetingsCount,
            recommendationsCount,
            tasks,
        ],
    );

    return (
        <div className="space-y-4">
            <WorkspaceSubTabBar
                activeSubTab={effectiveSubTab}
                counts={counts}
                visibleTabs={subTabs}
                onChange={onChangeSubTab}
            />

            {effectiveSubTab === "overview" ? (
                <Deferred
                    data={["notes", "tasks", "dealFollowUps", "taskBoardColumns"]}
                    fallback={<OverviewDeferredSkeleton />}
                >
                    <WorkspaceOverviewTab
                        deal={deal}
                        notes={notes ?? []}
                        tasks={tasks ?? []}
                        dealFollowUps={dealFollowUps ?? []}
                        taskBoardColumns={taskBoardColumns}
                        onNavigateToSubTab={onChangeSubTab}
                        onAddTask={onAddTask}
                        onAddMeeting={onAddMeeting}
                    />
                </Deferred>
            ) : (
                <>
                    {effectiveSubTab === "notes" && (
                        <Deferred data="notes" fallback={<TabDeferredSkeleton />}>
                            <WorkspaceNotesTab
                                deal={deal}
                                notes={notes ?? []}
                                permissions={permissions}
                                onAttachFiles={() => onChangeSubTab("files")}
                            />
                        </Deferred>
                    )}

                    {effectiveSubTab === "tasks" && (
                        <Deferred
                            data={["tasks", "taskBoardColumns"]}
                            fallback={<TabDeferredSkeleton />}
                        >
                            <WorkspaceTasksTab
                                tasks={tasks ?? []}
                                taskBoardColumns={taskBoardColumns}
                                permissions={permissions}
                                onAddTask={onAddTask}
                            />
                        </Deferred>
                    )}

                    {effectiveSubTab === "meetings" && (
                        <Deferred data="dealFollowUps" fallback={<TabDeferredSkeleton />}>
                            <WorkspaceMeetingsTab
                                deal={deal}
                                followUps={dealFollowUps ?? []}
                                meetingTypes={meetingTypes}
                                permissions={permissions}
                                onScheduleMeeting={onAddMeeting}
                            />
                        </Deferred>
                    )}

                    {effectiveSubTab === "files" && (
                        <Deferred data="files" fallback={<TabDeferredSkeleton />}>
                            <WorkspaceFilesTab
                                deal={deal}
                                files={files ?? []}
                                permissions={permissions}
                            />
                        </Deferred>
                    )}

                    {effectiveSubTab === "offers" && (
                        <WorkspaceOffersTab
                            deal={deal}
                            onCountChange={setOffersCount}
                        />
                    )}

                    {effectiveSubTab === "recommendations" && (
                        <WorkspaceRecommendationsTab
                            deal={deal}
                            permissions={permissions}
                            onCountChange={setRecommendationsCount}
                        />
                    )}

                    {effectiveSubTab === "itinerary" && (
                        <WorkspaceItineraryTab
                            deal={deal}
                            canAdd={dealPermissions.canEdit}
                            canDelete={dealPermissions.canDelete}
                        />
                    )}
                </>
            )}
        </div>
    );
}
