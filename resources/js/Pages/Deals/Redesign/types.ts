import type { PageProps } from "@/Components/DashboardLayout";
import type { DealSummaryPayload } from "@/Types/entity-summary";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Note } from "@/Types/api/note";
import type { Proposal } from "@/Types/api/proposal";
import type { Task } from "@/Types/api/tasks";

export type DealMainTab = "workspace" | "dealinfo" | "timeline";
export type WorkspaceSubTab =
    | "overview"
    | "notes"
    | "tasks"
    | "meetings"
    | "files"
    | "offers"
    | "recommendations";

export interface WorkspaceSubTabCount {
    notes?: number;
    tasks?: number;
    meetings?: number;
    files?: number;
    offers?: number;
    recommendations?: number;
}
export type DealInfoCoreSectionId =
    | "general"
    | "experience"
    | "property"
    | "income"
    | "location"
    | "preftimeline"
    | "funding"
    | "support";

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
    // C1 deferred — may be undefined until Inertia resolves them
    notes?: Note[];
    dealFollowUps?: DealFollowup[];
    files?: DealFile[];
    proposals?: Proposal[];
    histories?: any[];
    consents?: any[];
    gdprSetting?: any;
    tasks?: Task[];
    taskCategories?: any[];
    taskLabels?: any[];
    taskBoardColumns?: any[];
    employees?: any[];
    projects?: any[];
}
