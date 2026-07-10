import React, { useState } from "react";
import { Lead, LeadCategory } from "@/Types/api/leads";
import { Deal } from "@/Types/api/deals";
import { LeadNote } from "@/Types/api/lead-note";
import type { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Card, Tabs, Button, Tooltip, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
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
import type { LeadShowProps } from "./Show";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import { useTd } from "@/Hooks/useDynamicTranslation";
import LeadFlightItineraryTab from "@/Components/LeadFlightItineraryTab";

export default function LegacyLeadShow({
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
    leadAiSummary,
}: LeadShowProps) {
    const { props } = usePage<PageProps>();
    const { t } = useTranslation();
    const { td } = useTd();
    const featureFlags = pageFeatureFlags ?? props.featureFlags;
    const showQualificationTab =
        featureFlags?.["crm.lead-qualification-tab"] === true;
    const useLeadCoreFields =
        featureFlags?.["crm.lead-language-core-field"] === true;
    const showAiSummary = featureFlags?.["crm.lead-ai-summary"] === true;

    const [activeTab, setActiveTab] = useState(
        () =>
            new URLSearchParams(window.location.search).get("tab") || "profile",
    );
    const [isEditMode, setIsEditMode] = useState(false);
    const [scheduleMeetingOpen, setScheduleMeetingOpen] = useState(false);

    const canAddFollowUp =
        followUpPermissions.add_lead_follow_up === "all" ||
        followUpPermissions.add_lead_follow_up === "added";

    const showFollowUpTab =
        followUpPermissions.view_lead_follow_up === "all" ||
        followUpPermissions.view_lead_follow_up === "added";

    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !isEditMode,
    });

    const handleTabChange = (key: string) => {
        if (isEditMode) {
            message.warning(t("pages.leads.save_before_tab_switch"));
            return;
        }
        setActiveTab(key);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", key);
        window.history.replaceState({}, "", url.toString());
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
        {
            key: "itinerary",
            label: t("pages.flight_itinerary.tab"),
            children: (
                <LeadFlightItineraryTab
                    itineraryLegs={lead.lead_flight_itineraries || []}
                    leadId={lead.id}
                    permissions={{
                        canAdd: ["all", "added", "owned", "both"].includes(
                            editLeadPermission,
                        ),
                        canEdit: ["all", "added", "owned", "both"].includes(
                            editLeadPermission,
                        ),
                        canDelete: ["all", "added", "owned", "both"].includes(
                            deleteLeadPermission,
                        ),
                    }}
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
            tall: true,
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
                    className={`border-0 rounded-lg overflow-hidden${
                        (item as { tall?: boolean }).tall ? " min-h-[65vh]" : ""
                    }`}
                    bodyStyle={{ padding: 0 }}
                >
                    {item.children}
                </Card>
            </div>
        ),
    }));

    const leadName = [
        lead?.salutation_value
            ? lead.salutation_value.charAt(0).toUpperCase() +
              lead.salutation_value.slice(1)
            : null,
        lead?.client_name,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <PageLayout
            title={leadName}
            breadcrumbs={[
                {
                    name: t("pages.leads.contacts"),
                    url: route("lead-contact.index"),
                },
                { name: leadName },
            ]}
            mainContentClassName=""
        >
            {showAiSummary && (
                <div className="mx-auto max-w-4xl px-6 pt-6">
                    <EntityAiSummaryCard
                        entityType="lead"
                        entityId={lead.id}
                        initialSummary={leadAiSummary}
                        variant="legacy"
                        leadPhone={lead.mobile || lead.cell}
                    />
                </div>
            )}
            <div>
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
                        <Tooltip
                            title={
                                isEditMode
                                    ? t("pages.leads.refresh_tooltip_disabled")
                                    : td("Refresh")
                            }
                        >
                            <Button
                                icon={<ReloadOutlined spin={isRefreshing} />}
                                onClick={refresh}
                                disabled={isRefreshing || isEditMode}
                                type="text"
                            >
                                {td("Refresh")}
                            </Button>
                        </Tooltip>
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
}
