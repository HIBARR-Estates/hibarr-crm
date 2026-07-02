import type { PageProps } from "@/Components/DashboardLayout";
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
    notes: number;
    tasks: number;
    meetings: number;
    files: number;
    offers: number;
    recommendations: number;
}
export type DealInfoSectionId =
    | "general"
    | "experience"
    | "property"
    | "income"
    | "location"
    | "preftimeline"
    | "funding"
    | "support";

export interface DealShowProps extends PageProps {
    deal: Deal;
    productNames: string[];
    customFieldCategories: any[];
    fields: any[];
    notes: Note[];
    dealFollowUps: DealFollowup[];
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    files: DealFile[];
    proposals: Proposal[];
    histories: any[];
    consents: any[];
    gdprSetting: any;
    permissions: Record<string, string>;
    pageTitle: string;
    tasks: Task[];
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    employees: any[];
    projects: any[];
}
