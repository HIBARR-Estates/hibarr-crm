import React from "react";
import { Lead, LeadCategory } from "@/Types/api/leads";
import { Deal } from "@/Types/api/deals";
import { LeadNote } from "@/Types/api/lead-note";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Card, Tabs } from "antd";
import { User } from "@/Types";
import LeadInfoSection from "./Components/LeadInfoSection";
import LeadNotesTab from "./Components/LeadNotesTab";
import LeadDealsTab from "./Components/LeadDealsTab";
import LeadMarketingTab from "./Components/LeadMarketingTab";
import { Task } from "@/Types/api/tasks";
import TasksTab from "@/Components/TasksTab";

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
}

const Show: React.FC<LeadShowProps> = ({
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
}) => {
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
                />
            ),
        },
    ].map((item) => ({
        ...item,
        children: (
            <div className="max-w-7xl mx-auto mt-8 mb-12">
                <Card
                    className="shadow-sm border-0 rounded-lg overflow-hidden"
                    bodyStyle={{ padding: 0 }}
                >
                    {item.children}
                </Card>
            </div>
        ),
    }));

    return (
        <DashboardLayout>
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
                        items={tabItems}
                        className="lead-tabs"
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
        </DashboardLayout>
    );
};

export default Show;
