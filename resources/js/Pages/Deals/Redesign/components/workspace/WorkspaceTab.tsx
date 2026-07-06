import { useEffect, useMemo, useState } from "react";

import useWorkspaceOverview from "../../hooks/useWorkspaceOverview";

import { DealShowProps, WorkspaceSubTab } from "../../types";

import WorkspaceOverviewTab from "./WorkspaceOverviewTab";

import WorkspaceSubTabBar from "./WorkspaceSubTabBar";

import WorkspaceContextRail from "./rail/WorkspaceContextRail";
import DealAddTaskModal from "./DealAddTaskModal";
import DealScheduleMeetingModal from "./DealScheduleMeetingModal";
import WorkspaceNotesTab from "./WorkspaceNotesTab";
import WorkspaceTasksTab from "./WorkspaceTasksTab";
import WorkspaceMeetingsTab from "./WorkspaceMeetingsTab";
import WorkspaceFilesTab from "./WorkspaceFilesTab";
import WorkspaceOffersTab from "./WorkspaceOffersTab";
import WorkspaceRecommendationsTab from "./WorkspaceRecommendationsTab";



interface WorkspaceTabProps extends Pick<

    DealShowProps,

    | "deal"

    | "notes"

    | "tasks"

    | "dealFollowUps"

    | "files"

    | "proposals"

    | "fields"

    | "meetingTypes"

    | "taskBoardColumns"

    | "permissions"

> {

    activeSubTab: WorkspaceSubTab;

    onChangeSubTab: (tab: WorkspaceSubTab) => void;

    onSwitchToDealInfo: () => void;

}



export default function WorkspaceTab({

    deal,

    notes,

    tasks,

    dealFollowUps,

    files,

    proposals,

    fields = [],

    meetingTypes = [],

    taskBoardColumns,

    permissions,

    activeSubTab,

    onChangeSubTab,

    onSwitchToDealInfo,

}: WorkspaceTabProps) {

    const [addTaskOpen, setAddTaskOpen] = useState(false);

    const [addMeetingOpen, setAddMeetingOpen] = useState(false);

    const [recommendationsCount, setRecommendationsCount] = useState(0);



    const overview = useWorkspaceOverview({ notes, tasks, dealFollowUps });

    const subTabs = useMemo(() => {

        const tabs: WorkspaceSubTab[] = ["overview"];

        if (permissions.view_deal_note !== "none") tabs.push("notes");

        if (permissions.view_tasks !== "none") tabs.push("tasks");

        if (permissions.view_lead_follow_up !== "none") tabs.push("meetings");

        if (permissions.view_lead_files !== "none") tabs.push("files");

        tabs.push("offers", "recommendations");

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

            notes: notes.length,

            tasks: overview.openTasksCount,

            meetings: overview.upcomingMeetingsCount,

            files: files.length,

            offers: proposals.length,

            recommendations: recommendationsCount,

        }),

        [

            files.length,

            notes.length,

            overview.openTasksCount,

            overview.upcomingMeetingsCount,

            proposals.length,

            recommendationsCount,

        ],

    );



    const upcomingTasks = useMemo(

        () => overview.tasks.filter((task) => task.isOpen).slice(0, 5),

        [overview.tasks],

    );

    const upcomingMeetings = useMemo(

        () =>

            overview.meetings

                .filter((meeting) => meeting.isUpcoming)

                .slice(0, 5),

        [overview.meetings],

    );



    return (

        <>

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



            <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-[1fr_340px]">

                <div className="space-y-4">

                    <WorkspaceSubTabBar

                        activeSubTab={effectiveSubTab}

                        counts={counts}

                        visibleTabs={subTabs}

                        onChange={onChangeSubTab}

                    />



                    {effectiveSubTab === "overview" ? (

                        <WorkspaceOverviewTab

                            deal={deal}

                            notes={notes}

                            tasks={tasks}

                            dealFollowUps={dealFollowUps}

                            taskBoardColumns={taskBoardColumns}

                            onNavigateToSubTab={onChangeSubTab}

                            onAddTask={() => setAddTaskOpen(true)}

                            onAddMeeting={() => setAddMeetingOpen(true)}

                        />

                    ) : (

                        <>

                            {effectiveSubTab === "notes" && (
                                <WorkspaceNotesTab
                                    deal={deal}
                                    notes={notes}
                                    permissions={permissions}
                                    onAttachFiles={() =>
                                        onChangeSubTab("files")
                                    }
                                />
                            )}

                            {effectiveSubTab === "tasks" && (
                                <WorkspaceTasksTab
                                    tasks={tasks}
                                    taskBoardColumns={taskBoardColumns}
                                    permissions={permissions}
                                    onAddTask={() => setAddTaskOpen(true)}
                                />
                            )}

                            {effectiveSubTab === "meetings" && (
                                <WorkspaceMeetingsTab
                                    deal={deal}
                                    followUps={dealFollowUps}
                                    meetingTypes={meetingTypes}
                                    permissions={permissions}
                                    onScheduleMeeting={() =>
                                        setAddMeetingOpen(true)
                                    }
                                />
                            )}

                            {effectiveSubTab === "files" && (
                                <WorkspaceFilesTab
                                    deal={deal}
                                    files={files}
                                    permissions={permissions}
                                />
                            )}

                            {effectiveSubTab === "offers" && (
                                <WorkspaceOffersTab
                                    deal={deal}
                                    proposals={proposals}
                                    permissions={permissions}
                                />
                            )}

                            {effectiveSubTab === "recommendations" && (
                                <WorkspaceRecommendationsTab
                                    deal={deal}
                                    permissions={permissions}
                                    onCountChange={setRecommendationsCount}
                                />
                            )}

                        </>

                    )}

                </div>



                <WorkspaceContextRail

                    deal={deal}

                    files={files}

                    fields={fields}

                    upcomingTasks={upcomingTasks}

                    upcomingMeetings={upcomingMeetings}

                    onNavigateToSubTab={onChangeSubTab}

                    onSwitchToDealInfo={onSwitchToDealInfo}

                    onAddTask={() => setAddTaskOpen(true)}

                    onAddMeeting={() => setAddMeetingOpen(true)}

                />

            </div>

        </>

    );

}


