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
}) => {
    const tabItems = [
        {
            key: "profile",
            label: "Profile",
            children: (
                <div className="max-w-7xl mx-auto">
                    <Card
                        className="shadow-sm border-0 rounded-lg overflow-hidden"
                        bodyStyle={{ padding: 0 }}
                    >
                        <LeadInfoSection
                            lead={lead}
                            customFieldCategories={customFieldCategories}
                            fields={fields}
                            editLeadPermission={editLeadPermission}
                            deleteLeadPermission={deleteLeadPermission}
                        />
                    </Card>
                </div>
            ),
        },
        {
            key: "deals",
            label: "Deals",
            children: (
                <div className="max-w-7xl mx-auto">
                    <LeadDealsTab
                        lead={lead}
                        deals={deals}
                        permissions={dealPermissions}
                    />
                </div>
            ),
        },
        {
            key: "notes",
            label: "Notes",
            children: (
                <div className="max-w-7xl mx-auto">
                    <LeadNotesTab
                        lead={lead}
                        notes={notes}
                        permissions={notePermissions}
                    />
                </div>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={lead?.client_name_salutation}
                breadcrumbs={[
                    { name: "Leads", url: route("lead-contact.index") },
                    { name: lead?.client_name || "" },
                ]}
                mainContentClassName=""
            >
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
            </PageLayout>
        </DashboardLayout>
    );
};

export default Show;
