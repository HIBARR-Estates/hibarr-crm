import type { LeadRedesignProps, LeadDrawerTab } from "../../types";
import type useLeadOverview from "../../hooks/useLeadOverview";
import LeadDrawerTabBar, { type DrawerTabConfig } from "./LeadDrawerTabBar";
import OverviewPane from "./panes/OverviewPane";
import ActivityTab from "../activity/ActivityTab";
import LeadNotesTab from "@/Pages/Leads/Components/LeadNotesTab";
import TasksTab from "@/Components/TasksTab";
import LeadFollowUpTab from "@/Pages/Leads/Components/LeadFollowUpTab";
import LeadDealsTab from "@/Pages/Leads/Components/LeadDealsTab";
import LeadMarketingTab from "@/Pages/Leads/Components/LeadMarketingTab";
import LeadInfoSection from "@/Pages/Leads/Components/LeadInfoSection";
import LeadIcon from "../primitives/LeadIcon";
import useTranslation from "@/Hooks/useTranslation";

type OverviewData = ReturnType<typeof useLeadOverview>;

interface LeadDrawerProps extends LeadRedesignProps {
    drawerTab: LeadDrawerTab;
    onDrawerTabChange: (tab: LeadDrawerTab) => void;
    overview: OverviewData;
    profileEditMode: boolean;
    onProfileEditModeChange: (value: boolean) => void;
    onScheduleMeeting?: () => void;
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
    onScheduleMeeting,
    drawerRef,
}: LeadDrawerProps) {
    const { t } = useTranslation();
    const useLeadCoreFields =
        featureFlags?.["crm.lead-language-core-field"] === true;

    const showMeetings =
        followUpPermissions.view_lead_follow_up === "all" ||
        followUpPermissions.view_lead_follow_up === "added";

    const canAddFollowUp =
        followUpPermissions.add_lead_follow_up === "all" ||
        followUpPermissions.add_lead_follow_up === "added";

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
            <header className="flex items-center gap-2 border-b border-[#eef1f5] px-4 py-3">
                <LeadIcon name="grid" size={15} color="#1a6bb5" />
                <h3 className="text-sm font-semibold text-[#1a1f2e]">Lead workspace</h3>
            </header>
            <LeadDrawerTabBar
                tabs={tabs}
                activeTab={drawerTab}
                onChange={onDrawerTabChange}
            />
            <div className="p-4">
                {drawerTab === "overview" && (
                    <OverviewPane overview={overview} onNavigate={onDrawerTabChange} />
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
                    <TasksTab
                        tasks={tasks}
                        relatedEntity={{ type: "lead", id: lead.id }}
                        taskCategories={taskCategories}
                        taskLabels={taskLabels}
                        taskBoardColumns={taskBoardColumns}
                        employees={employees}
                        projects={projects}
                        permissions={permissions as any}
                    />
                )}
                {drawerTab === "meetings" && showMeetings && (
                    <LeadFollowUpTab
                        lead={lead}
                        followUps={leadFollowUps}
                        permissions={followUpPermissions}
                        deals={deals}
                        onScheduleMeeting={
                            canAddFollowUp ? onScheduleMeeting : undefined
                        }
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
