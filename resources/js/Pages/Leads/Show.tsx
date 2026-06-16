import React, { useState } from "react";
import { Lead, LeadCategory } from "@/Types/api/leads";
import { Deal } from "@/Types/api/deals";
import { LeadNote } from "@/Types/api/lead-note";
import DashboardLayout from "@/Components/DashboardLayout";
import type { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Card, Tabs, Button, Tooltip, message } from "antd";
import { ReloadOutlined, PlusOutlined } from "@ant-design/icons";
import { DealFollowup } from "@/Types/api/deal-followup";
import LeadFollowUpTab from "./Components/LeadFollowUpTab";
import AddFollowup from "@/Pages/Deals/Components/Tabs/followups/AddFollowup";
import { User } from "@/Types";
import LeadInfoSection from "./Components/LeadInfoSection";
import LeadNotesTab from "./Components/LeadNotesTab";
import LeadDealsTab from "./Components/LeadDealsTab";
import LeadMarketingTab from "./Components/LeadMarketingTab";
import LeadQualificationTab from "./Components/Qualification/LeadQualificationTab";
import { Task } from "@/Types/api/tasks";
import TasksTab from "@/Components/TasksTab";
import { CrmEventTimeline } from "@/Components/CrmEvents";
import { usePage } from "@inertiajs/react";
import usePageRefresh from "@/Hooks/usePageRefresh";
import useTranslation from "@/Hooks/useTranslation";

export interface LeadShowProps {
    lead: Lead;
    categories: LeadCategory[];
    sources: any[];
    employees: User[];
    countries: Array<{ iso: string; nicename: string; iso3: string }>;
    salutations: Array<{ value: string; label: string }>;
    customFieldCategories?: any[];
    fields?: any[];
    editLeadPermission: string;
    deleteLeadPermission: string;
    deals: Deal[];
    notes: LeadNote[];
    dealPermissions: Record<string, string>;
    notePermissions: Record<string, string>;
    tasks: Task[];
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    projects: any[];
    permissions: Record<string, string>;
    leadFollowUps?: DealFollowup[];
    meetingTypes?: { id: number; name: string; color?: string }[];
    followUpPermissions?: Record<string, string>;
    featureFlags?: Record<string, boolean>;
}

const Show = ({
    lead,
    customFieldCategories,
    fields,
    editLeadPermission,
    deleteLeadPermission,
    deals,
    notes,
    dealPermissions,
    notePermissions,
    employees,
    tasks,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    projects,
    permissions,
    leadFollowUps = [],
    followUpPermissions = {},
    featureFlags: pageFeatureFlags,
}: LeadShowProps) => {
    const { props } = usePage<PageProps>();
    const { t } = useTranslation();
    const featureFlags = pageFeatureFlags ?? props.featureFlags;
    const showQualificationTab = true;
    const useLeadCoreFields =
        featureFlags?.["crm.lead-language-core-field"] === true;

    const [activeTab, setActiveTab] = useState("profile");
    const [isEditMode, setIsEditMode] = useState(false);
    const [scheduleMeetingOpen, setScheduleMeetingOpen] = useState(false);

    const canAddFollowUp =
        followUpPermissions.add_lead_follow_up === "all" ||
        followUpPermissions.add_lead_follow_up === "added";

    const showFollowUpTab =
        followUpPermissions.view_lead_follow_up === "all" ||
        followUpPermissions.view_lead_follow_up === "added";

    // ── Page-level refresh ──────────────────────────────────────────
    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !isEditMode,
    });

    const handleTabChange = (key: string) => {
        if (isEditMode) {
            message.warning(t("pages.leads.save_before_tab_switch"));
            return;
        }
        setActiveTab(key);
    };

    const tabItems = [
        {
            key: "profile",
            label: t("pages.leads.tabs.profile"),
            children: (
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
                    isEditMode={isEditMode}
                    onEditModeChange={setIsEditMode}
                    useLeadCoreFields={useLeadCoreFields}
                />
            ),
        },
        {
            key: "deals",
            label: t("app.deal"),
            children: (
                <LeadDealsTab
                    lead={lead}
                    deals={deals}
                    permissions={dealPermissions}
                />
            ),
        },
        ...(showFollowUpTab
            ? [
                  {
                      key: "follow-up",
                      label: t("modules.lead.followUp"),
                      children: (
                          <LeadFollowUpTab
                              lead={lead}
                              followUps={leadFollowUps}
                              permissions={followUpPermissions}
                              deals={deals}
                              onScheduleMeeting={
                                  canAddFollowUp
                                      ? () => setScheduleMeetingOpen(true)
                                      : undefined
                              }
                          />
                      ),
                  },
              ]
            : []),
        {
            key: "notes",
            label: t("pages.leads.tabs.notes"),
            children: (
                <LeadNotesTab
                    lead={lead}
                    notes={notes}
                    permissions={notePermissions}
                />
            ),
        },
        {
            key: "marketing",
            label: t("pages.leads.tabs.marketing"),
            children: <LeadMarketingTab lead={lead} />,
        },
        ...(showQualificationTab
            ? [
                  {
                      key: "qualification",
                      label: t("pages.leads.tabs.qualification"),
                      children: <LeadQualificationTab lead={lead} />,
                      wide: true,
                  },
              ]
            : []),
        {
            key: "tasks",
            label: t("pages.leads.tabs.tasks"),
            children: (
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
            ),
        },
        {
            key: "events",
            label: t("pages.leads.tabs.events"),
            children: (
                <CrmEventTimeline
                    modelType="App\\Models\\Lead"
                    modelId={lead.id}
                    userId={props.auth?.user?.id}
                    compact={false}
                    entityName={lead.client_name ?? undefined}
                />
            ),
        },
    ].map((item) => ({
        ...item,
        children: (
            <div
                className={`${
                    (item as { wide?: boolean }).wide
                        ? "max-w-6xl"
                        : "max-w-4xl"
                } mx-auto mt-8 mb-12`}
            >
                <Card
                    variant="outlined"
                    className="border-0 rounded-lg overflow-hidden"
                    bodyStyle={{ padding: 0 }}
                >
                    {item.children}
                </Card>
            </div>
        ),
    }));

    return (
        <PageLayout
            title={lead?.client_name_salutation}
            breadcrumbs={[
                {
                    name: t("pages.leads.contacts"),
                    url: route("lead-contact.index"),
                },
                { name: lead?.client_name || "" },
            ]}
            mainContentClassName=""
        >
            <div>
                <div className="flex items-center justify-end px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <Tooltip
                        title={
                            isEditMode
                                ? t("pages.leads.refresh_tooltip_disabled")
                                : t("app.common.actions.refresh")
                        }
                    >
                        <Button
                            icon={<ReloadOutlined spin={isRefreshing} />}
                            onClick={refresh}
                            disabled={isRefreshing || isEditMode}
                            type="text"
                        >
                            {t("app.common.actions.refresh")}
                        </Button>
                    </Tooltip>
                </div>
                <Tabs
                    items={tabItems}
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    className="lead-tabs"
                    tabBarStyle={{
                        paddingLeft: 24,
                        paddingRight: 24,
                        marginBottom: 0,
                        backgroundColor: "#fafafa",
                        borderBottom: "1px solid #f0f0f0",
                    }}
                    tabBarExtraContent={
                        activeTab === "follow-up" && canAddFollowUp ? (
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setScheduleMeetingOpen(true)}
                            >
                                {t("pages.deals.actions.add_meeting")}
                            </Button>
                        ) : null
                    }
                />
            </div>

            <AddFollowup
                context="lead"
                lead={lead}
                dealsForLead={deals.map((d) => ({
                    id: d.id,
                    name: d.name,
                }))}
                open={scheduleMeetingOpen}
                onClose={() => setScheduleMeetingOpen(false)}
            />
        </PageLayout>
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
