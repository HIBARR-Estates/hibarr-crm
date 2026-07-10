import { useState } from "react";
import type { LeadRedesignProps, LeadDrawerTab } from "../../types";
import type useLeadOverview from "../../hooks/useLeadOverview";
import LeadDrawerTabBar, { type DrawerTabConfig } from "./LeadDrawerTabBar";
import OverviewPane from "./panes/OverviewPane";
import ActivityTab from "../activity/ActivityTab";
import LeadNotesTab from "@/Pages/Leads/Components/LeadNotesTab";
import LeadTasksTab from "./panes/LeadTasksTab";
import LeadMeetingsTab from "./panes/LeadMeetingsTab";
import LeadDealsTab from "@/Pages/Leads/Components/LeadDealsTab";
import LeadMarketingTab from "@/Pages/Leads/Components/LeadMarketingTab";
import LeadInfoSection from "@/Pages/Leads/Components/LeadInfoSection";
import LeadIcon from "../primitives/LeadIcon";
import useTranslation from "@/Hooks/useTranslation";
import LeadAddTaskModal from "./panes/overview/LeadAddTaskModal";
import LeadScheduleMeetingModal from "./panes/overview/LeadScheduleMeetingModal";

type OverviewData = ReturnType<typeof useLeadOverview>;

interface LeadDrawerProps extends LeadRedesignProps {
    drawerTab: LeadDrawerTab;
    onDrawerTabChange: (tab: LeadDrawerTab) => void;
    overview: OverviewData;
    profileEditMode: boolean;
    onProfileEditModeChange: (value: boolean) => void;
    drawerRef?: React.RefObject<HTMLDivElement | null>;
}

export default function LeadDrawer({
    lead,
    notes,
    tasks,
    deals,
    dealPermissions,
    notePermissions,
    permissions,
    leadFollowUps = [],
    meetingTypes = [],
    followUpPermissions = {},
    customFieldCategories,
    fields,
    editLeadPermission,
    deleteLeadPermission,
    employees,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    projects,
    featureFlags,
    drawerTab,
    onDrawerTabChange,
    overview,
    profileEditMode,
    onProfileEditModeChange,
    drawerRef,
}: LeadDrawerProps) {
    const { t } = useTranslation();
    const [addTaskOpen, setAddTaskOpen] = useState(false);
    const [addMeetingOpen, setAddMeetingOpen] = useState(false);

    const useLeadCoreFields =
        featureFlags?.["crm.lead-language-core-field"] === true;

    const showMeetings =
        followUpPermissions.view_lead_follow_up === "all" ||
        followUpPermissions.view_lead_follow_up === "added";

    const canAddFollowUp =
        followUpPermissions.add_lead_follow_up === "all" ||
        followUpPermissions.add_lead_follow_up === "added";

    const canAddTask =
        permissions?.add_tasks === "all" ||
        permissions?.add_tasks === "added" ||
        permissions?.add_tasks === "both";

    const canAddNote =
        notePermissions.add_lead_note === "all" ||
        notePermissions.add_lead_note === "added" ||
        notePermissions.add_lead_note === "both";

    const tabs: DrawerTabConfig[] = [
        { id: "overview", label: "Overview", icon: "grid" },
        {
            id: "profile",
            label: t("pages.leads.tabs.profile"),
            icon: "user",
        },
        {
            id: "tasks",
            label: t("pages.leads.tabs.tasks"),
            icon: "check",
            count: overview.openTasksCount,
        },
        {
            id: "meetings",
            label: t("modules.lead.followUp"),
            icon: "calendar",
            count: overview.upcomingMeetingsCount,
            hidden: !showMeetings,
        },
        {
            id: "deals",
            label: t("app.deal"),
            icon: "briefcase",
            count: deals.length,
        },
        {
            id: "notes",
            label: t("pages.leads.tabs.notes"),
            icon: "file-text",
            count: notes.length,
        },
        {
            id: "marketing",
            label: t("pages.leads.tabs.marketing"),
            icon: "target",
        },
        {
            id: "activity",
            label: t("pages.leads.tabs.events"),
            icon: "activity",
        },
    ];

    return (
        <div ref={drawerRef} className="section-card">
            <LeadAddTaskModal
                open={addTaskOpen}
                onClose={() => setAddTaskOpen(false)}
                leadId={lead.id}
            />
            <LeadScheduleMeetingModal
                open={addMeetingOpen}
                onClose={() => setAddMeetingOpen(false)}
                lead={lead}
                meetingTypes={meetingTypes}
                deals={deals.map((deal) => ({ id: deal.id, name: deal.name }))}
            />

            <header className="flex items-center gap-2 border-b border-[#eef1f5] px-4 py-3">
                <LeadIcon name="grid" size={15} color="#1a6bb5" />
                <h3 className="text-sm font-semibold text-[#1a1f2e]">
                    Lead workspace
                </h3>
            </header>
            <LeadDrawerTabBar
                tabs={tabs}
                activeTab={drawerTab}
                onChange={onDrawerTabChange}
            />
            <div className="p-4">
                {drawerTab === "overview" && (
                    <OverviewPane
                        lead={lead}
                        overview={overview}
                        tasks={tasks}
                        taskBoardColumns={taskBoardColumns}
                        canAddNote={canAddNote}
                        canAddTask={canAddTask}
                        canAddMeeting={canAddFollowUp}
                        onNavigate={onDrawerTabChange}
                        onAddTask={() => setAddTaskOpen(true)}
                        onAddMeeting={() => setAddMeetingOpen(true)}
                    />
                )}
                {drawerTab === "profile" && (
                    <LeadInfoSection
                        lead={lead}
                        customFieldCategories={customFieldCategories}
                        fields={fields}
                        editLeadPermission={editLeadPermission}
                        deleteLeadPermission={deleteLeadPermission}
                        taskCategories={taskCategories}
                        taskLabels={taskLabels}
                        taskBoardColumns={taskBoardColumns}
                        employees={employees}
                        projects={projects}
                        isEditMode={profileEditMode}
                        onEditModeChange={onProfileEditModeChange}
                        useLeadCoreFields={useLeadCoreFields}
                    />
                )}
                {drawerTab === "tasks" && (
                    <LeadTasksTab
                        tasks={tasks}
                        taskBoardColumns={taskBoardColumns}
                        permissions={permissions}
                        onAddTask={() => setAddTaskOpen(true)}
                    />
                )}
                {drawerTab === "meetings" && showMeetings && (
                    <LeadMeetingsTab
                        lead={lead}
                        followUps={leadFollowUps}
                        permissions={followUpPermissions}
                        onScheduleMeeting={() => setAddMeetingOpen(true)}
                    />
                )}
                {drawerTab === "deals" && (
                    <LeadDealsTab
                        lead={lead}
                        deals={deals}
                        permissions={dealPermissions}
                    />
                )}
                {drawerTab === "notes" && (
                    <LeadNotesTab
                        lead={lead}
                        notes={notes}
                        permissions={notePermissions}
                    />
                )}
                {drawerTab === "marketing" && <LeadMarketingTab lead={lead} />}
                {drawerTab === "activity" && (
                    <ActivityTab leadId={lead.id} leadName={lead.client_name} />
                )}
            </div>
        </div>
    );
}
