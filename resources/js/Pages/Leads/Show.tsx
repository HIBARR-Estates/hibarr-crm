import React from "react";
import { Lead, LeadCategory } from "@/Types/api/leads";
import { Deal } from "@/Types/api/deals";
import { LeadNote } from "@/Types/api/lead-note";
import DashboardLayout from "@/Components/DashboardLayout";
import { DealFollowup } from "@/Types/api/deal-followup";
import { User } from "@/Types";
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
    dealPermissions: Record<string, string>;
    notePermissions: Record<string, string>;
    /** Task permissions (also mirrored as `permissions` for TasksTab). */
    taskPermissions?: Record<string, string>;
    permissions?: Record<string, string>;
    meetingTypes?: { id: number; name: string; color?: string }[];
    followUpPermissions?: Record<string, string>;
    qualificationPermissions?: Record<string, string>;
    featureFlags?: Record<string, boolean>;
    leadAiSummary?: EntitySummaryPayload | null;
    // C1 deferred — may be undefined until Inertia resolves them
    notes?: LeadNote[];
    tasks?: Task[];
    leadFollowUps?: DealFollowup[];
    taskCategories?: any[];
    taskLabels?: any[];
    taskBoardColumns?: any[];
    projects?: any[];
    leadPipelines?: any[];
    leadStages?: any[];
    stages?: any[];
    leadAgents?: any[];
    nonActiveLeadAgents?: any[];
    leadContacts?: any[];
    products?: any[];
    packages?: any[];
    dealCustomFields?: any[];
    dealCustomFieldCategories?: any[];
    pipelineCustomFieldCategoryIdsByPipeline?: Record<string, number[]>;
}

/**
 * Shell / permission defaults only.
 * Leave C1 deferred collections undefined while pending so redesign can skeleton (C4).
 */
export function withLeadShowShellDefaults(props: LeadShowProps): LeadShowProps {
    return {
        ...props,
        deals: props.deals ?? [],
        employees: props.employees ?? [],
        permissions:
            props.permissions ?? props.taskPermissions ?? ({} as Record<string, string>),
        dealPermissions: props.dealPermissions ?? {},
        notePermissions: props.notePermissions ?? {},
        followUpPermissions: props.followUpPermissions ?? {},
        meetingTypes: props.meetingTypes ?? [],
    };
}

/** Legacy path: fill deferred keys so Blade/legacy tabs never see undefined iterables. */
export function withLeadShowDefaults(
    props: LeadShowProps,
): LeadShowProps & {
    notes: LeadNote[];
    tasks: Task[];
    leadFollowUps: DealFollowup[];
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    projects: any[];
    deals: Deal[];
    permissions: Record<string, string>;
} {
    const shell = withLeadShowShellDefaults(props);
    return {
        ...shell,
        notes: shell.notes ?? [],
        tasks: shell.tasks ?? [],
        leadFollowUps: shell.leadFollowUps ?? [],
        taskCategories: shell.taskCategories ?? [],
        taskLabels: shell.taskLabels ?? [],
        taskBoardColumns: shell.taskBoardColumns ?? [],
        projects: shell.projects ?? [],
        leadPipelines: shell.leadPipelines ?? [],
        leadStages: shell.leadStages ?? [],
        stages: shell.stages ?? [],
        leadAgents: shell.leadAgents ?? [],
        nonActiveLeadAgents: shell.nonActiveLeadAgents ?? [],
        leadContacts: shell.leadContacts ?? [],
        products: shell.products ?? [],
        packages: shell.packages ?? [],
        dealCustomFields: shell.dealCustomFields ?? [],
        dealCustomFieldCategories: shell.dealCustomFieldCategories ?? [],
    };
}

const Show = (props: LeadShowProps) => {
    const page = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? page.props.featureFlags;
    const useRedesign = featureFlags?.["crm.lead-view-redesign"] === true;

    return useRedesign ? (
        <LeadViewRedesign {...withLeadShowShellDefaults(props)} />
    ) : (
        <LegacyLeadShow {...withLeadShowDefaults(props)} />
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
