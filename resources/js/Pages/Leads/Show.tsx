import React, { useState } from "react";
import { Lead, LeadCategory } from "@/Types/api/leads";
import { Deal } from "@/Types/api/deals";
import { LeadNote } from "@/Types/api/lead-note";
import DashboardLayout from "@/Components/DashboardLayout";
import type { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Card, Tabs, message } from "antd";
import { User } from "@/Types";
import LeadInfoSection from "./Components/LeadInfoSection";
import LeadNotesTab from "./Components/LeadNotesTab";
import LeadDealsTab from "./Components/LeadDealsTab";
import LeadMarketingTab from "./Components/LeadMarketingTab";
import { Task } from "@/Types/api/tasks";
import TasksTab from "@/Components/TasksTab";
import { CrmEventTimeline } from "@/Components/CrmEvents";
import { usePage } from "@inertiajs/react";

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
}: LeadShowProps) => {
    const { props } = usePage<PageProps>();

    const [activeTab, setActiveTab] = useState("profile");
    const [isEditMode, setIsEditMode] = useState(false);

    const handleTabChange = (key: string) => {
        if (isEditMode) {
            message.warning(
                "Please save or cancel your changes before switching tabs.",
            );
            return;
        }
        setActiveTab(key);
    };

    const tabItems = [
        {
            key: "profile",
            label: "Profile",
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
                />
            ),
        },
        {
            key: "deals",
            label: "Deals",
            children: (
                <LeadDealsTab
                    lead={lead}
                    deals={deals}
                    permissions={dealPermissions}
                />
            ),
        },
        {
            key: "notes",
            label: "Notes",
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
            label: "Marketing",
            children: <LeadMarketingTab lead={lead} />,
        },
        {
            key: "tasks",
            label: "Tasks",
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
            label: "Events",
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
            <div className="max-w-7xl mx-auto mt-8 mb-12">
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
                { name: "Contacts", url: route("lead-contact.index") },
                { name: lead?.client_name || "" },
            ]}
            mainContentClassName=""
        >
            <div>
                <Tabs
                    items={tabItems}                    activeKey={activeTab}
                    onChange={handleTabChange}                    className="lead-tabs"
                    tabBarStyle={{
                        paddingLeft: 24,
                        paddingRight: 24,
                        marginBottom: 0,
                        backgroundColor: "#fafafa",
                        borderBottom: "1px solid #f0f0f0",
                    }}
                />
            </div>
        </PageLayout>
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
