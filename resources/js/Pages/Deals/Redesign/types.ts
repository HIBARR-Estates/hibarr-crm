import type { PageProps } from "@/Components/DashboardLayout";
import type { DealSummaryPayload } from "@/Types/entity-summary";
import type { Deal } from "@/Types/api/deals";
import type { Proposal } from "@/Types/api/proposal";

/**
 * v2.2 uses a single flat tab bar: record tabs, then a divider, then meta tabs.
 * There is no separate "workspace" wrapper tab.
 */
export type DealRecordTab =
    | "overview"
    | "notes"
    | "tasks"
    | "meetings"
    | "files"
    | "offers"
    | "recommendations"
    | "itinerary";

export type DealMetaTab = "dealinfo" | "timeline";

export type DealTab = DealRecordTab | DealMetaTab;

export interface DealTabCount {
    notes?: number;
    tasks?: number;
    meetings?: number;
    files?: number;
    offers?: number;
    recommendations?: number;
    itinerary?: number;
}
export type DealInfoCoreSectionId =
    | "general"
    | "experience"
    | "income"
    | "location"
    | "preftimeline"
    | "funding"
    | "support"
    | "gdpr";

export type DealInfoSectionId =
    | DealInfoCoreSectionId
    | `category-${number}`;

export interface DealShowProps extends PageProps {
    deal: Deal;
    productNames: string[];
    customFieldCategories: any[];
    fields: any[];
    meetingTypes?: Array<{ id: number; name: string; color?: string }>;
    permissions: Record<string, string>;
    pageTitle: string;
    dealAiSummary?: DealSummaryPayload | null;
    restrictPackageOrProperty?: boolean;
    // notes / dealFollowUps / files / tasks fetch independently via
    // deals.notes.index / deals.meetings.index / deals.files.index /
    // deals.tasks.index (see DealWorkspaceContext) — no longer page props.
    // C1 deferred — may be undefined until Inertia resolves them
    proposals?: Proposal[];
    histories?: any[];
    consents?: any[];
    gdprSetting?: any;
    taskCategories?: any[];
    taskLabels?: any[];
    taskBoardColumns?: any[];
    employees?: any[];
    projects?: any[];
}
