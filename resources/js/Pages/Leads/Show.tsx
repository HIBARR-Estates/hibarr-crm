import React from "react";
import { Lead, LeadCategory } from "@/Types/api/leads";
import { Deal } from "@/Types/api/deals";
import { LeadNote } from "@/Types/api/lead-note";
import DashboardLayout from "@/Components/DashboardLayout";
import { DealFollowup } from "@/Types/api/deal-followup";
import { User } from "@/Types";
import LeadInfoSection from "./Components/LeadInfoSection";
import LeadNotesTab from "./Components/LeadNotesTab";
import LeadDealsTab from "./Components/LeadDealsTab";
import LeadMarketingTab from "./Components/LeadMarketingTab";
import LeadQualificationTab from "./Components/Qualification/LeadQualificationTab";
import LeadFlightItineraryTab from "@/Components/LeadFlightItineraryTab";
import { Task } from "@/Types/api/tasks";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import type { EntitySummaryPayload } from "@/Types/entity-summary";
import LegacyLeadShow from "./LegacyLeadShow";
import LeadViewRedesign from "./Redesign/LeadViewRedesign";

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
    leadAiSummary?: EntitySummaryPayload | null;
}

const Show = (props: LeadShowProps) => {
    const page = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? page.props.featureFlags;
    const useRedesign = featureFlags?.["crm.lead-view-redesign"] === true;

    return useRedesign ? (
        <LeadViewRedesign {...props} />
    ) : (
        <LegacyLeadShow {...props} />
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
