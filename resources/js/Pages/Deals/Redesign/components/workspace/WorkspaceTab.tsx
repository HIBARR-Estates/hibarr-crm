import DealOffersTab from "@/Features/Deals/DealOffersTab";

import TasksTab from "@/Components/TasksTab";

import FilesTab from "@/Pages/Deals/Components/Tabs/FilesTab";

import FollowUpTab from "@/Pages/Deals/Components/Tabs/FollowUpTab";

import NotesTab from "@/Pages/Deals/Components/Tabs/NotesTab";

import RecommendationsTab from "@/Pages/Deals/Components/Tabs/RecommendationsTab";

import useTranslation from "@/Hooks/useTranslation";

import { useTd } from "@/Hooks/useDynamicTranslation";

import { ReactNode, useEffect, useMemo, useState } from "react";

import useWorkspaceOverview from "../../hooks/useWorkspaceOverview";

import { DealShowProps, WorkspaceSubTab } from "../../types";

import WorkspaceOverviewTab from "./WorkspaceOverviewTab";

import WorkspaceSubTabBar from "./WorkspaceSubTabBar";

import WorkspaceContextRail from "./rail/WorkspaceContextRail";
import DealAddTaskModal from "./DealAddTaskModal";
import DealScheduleMeetingModal from "./DealScheduleMeetingModal";



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

    | "taskCategories"

    | "taskLabels"

    | "taskBoardColumns"

    | "employees"

    | "projects"

    | "permissions"

> {

    activeSubTab: WorkspaceSubTab;

    onChangeSubTab: (tab: WorkspaceSubTab) => void;

    onSwitchToDealInfo: () => void;

}



function WorkspacePaneCard({

    title,

    children,

}: {

    title: string;

    children: ReactNode;

}) {

    return (

        <section className="overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">

            <div className="border-b border-[#eef1f5] px-4 py-3">

                <h3 className="text-sm font-semibold text-[#1a1f2e]">

                    {title}

                </h3>

            </div>

            <div>{children}</div>

        </section>

    );

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

    taskCategories,

    taskLabels,

    taskBoardColumns,

    employees,

    projects,

    permissions,

    activeSubTab,

    onChangeSubTab,

    onSwitchToDealInfo,

}: WorkspaceTabProps) {

    const { t } = useTranslation();

    const { td } = useTd();

    const [addTaskOpen, setAddTaskOpen] = useState(false);

    const [addMeetingOpen, setAddMeetingOpen] = useState(false);



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

            recommendations: 0,

        }),

        [

            files.length,

            notes.length,

            overview.openTasksCount,

            overview.upcomingMeetingsCount,

            proposals.length,

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

                                <WorkspacePaneCard

                                    title={t("pages.deals.tabs.notes")}

                                >

                                    <NotesTab

                                        deal={deal}

                                        notes={notes}

                                        permissions={permissions}

                                    />

                                </WorkspacePaneCard>

                            )}

                            {effectiveSubTab === "tasks" && (

                                <WorkspacePaneCard title={td("Tasks")}>

                                    <TasksTab

                                        tasks={tasks}

                                        relatedEntity={{

                                            type: "deal",

                                            id: deal.id,

                                        }}

                                        taskCategories={taskCategories}

                                        taskLabels={taskLabels}

                                        taskBoardColumns={taskBoardColumns}

                                        employees={employees}

                                        projects={projects}

                                        permissions={permissions as any}

                                    />

                                </WorkspacePaneCard>

                            )}

                            {effectiveSubTab === "meetings" && (

                                <WorkspacePaneCard

                                    title={t("pages.deals.tabs.meeting")}

                                >

                                    <FollowUpTab

                                        deal={deal}

                                        followUps={dealFollowUps}

                                        permissions={permissions}

                                    />

                                </WorkspacePaneCard>

                            )}

                            {effectiveSubTab === "files" && (

                                <WorkspacePaneCard

                                    title={t("pages.deals.tabs.files")}

                                >

                                    <FilesTab

                                        deal={deal}

                                        files={files}

                                        permissions={permissions}

                                    />

                                </WorkspacePaneCard>

                            )}

                            {effectiveSubTab === "offers" && (

                                <WorkspacePaneCard

                                    title={t("pages.deals.tabs.offers")}

                                >

                                    <DealOffersTab deal={deal} />

                                </WorkspacePaneCard>

                            )}

                            {effectiveSubTab === "recommendations" && (

                                <WorkspacePaneCard

                                    title={t(

                                        "pages.deals.tabs.recommendations",

                                    )}

                                >

                                    <RecommendationsTab

                                        deal={deal}

                                        permissions={permissions}

                                    />

                                </WorkspacePaneCard>

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


