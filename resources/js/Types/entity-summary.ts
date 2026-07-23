export type EntitySummaryRiskLevel = "none" | "low" | "medium" | "high";

export type EntitySummaryChipTone = "green" | "amber" | "red" | "neutral";

export type LeadSummaryActionType =
    | "CONTACT_LEAD"
    | "SCHEDULE_CALL"
    | "SEND_FOLLOWUP_EMAIL"
    | "QUALIFY_LEAD"
    | "REQUEST_MISSING_INFO"
    | "OPEN_DEAL"
    | "REVIEW_DEALS"
    | "ESCALATE_TO_MANAGER"
    | "NO_ACTION_NEEDED";

export type DealSummaryActionType =
    | "CREATE_TASK"
    | "SCHEDULE_CALL"
    | "REQUEST_DOCUMENTS"
    | "SEND_FOLLOWUP_EMAIL"
    | "ADVANCE_STAGE"
    | "ESCALATE_TO_MANAGER"
    | "REVIEW_STALE_DEAL"
    | "NO_ACTION_NEEDED";

export type EntitySummaryActionType =
    | LeadSummaryActionType
    | DealSummaryActionType;

export type EntitySummaryPrimaryRiskSource = "linked_deal" | "lead" | "none";

export interface EntitySummaryChip {
    id: string;
    label: string;
    value: string;
    tone: EntitySummaryChipTone;
    sublabel: string;
}

export interface EntitySummaryNextStep {
    action_type: EntitySummaryActionType;
    target_deal_id?: string | null;
    label: string;
    rationale: string;
    urgency: "immediate" | "this_week" | "routine";
}

export interface EntitySummaryMeta {
    generated_at: string;
    data_confidence: "high" | "medium" | "low";
    stale_data_warning?: boolean;
    is_stale?: boolean;
    source?: "ai" | "heuristic";
}

export interface LeadSummaryPayload {
    status_line: string;
    risk_level: EntitySummaryRiskLevel;
    primary_risk_source: EntitySummaryPrimaryRiskSource;
    chips: EntitySummaryChip[];
    bullets: string[];
    next_step: EntitySummaryNextStep;
    meta: EntitySummaryMeta;
}

export interface DealSummaryPayload {
    status_line: string;
    risk_level: EntitySummaryRiskLevel;
    chips: EntitySummaryChip[];
    bullets: string[];
    next_step: EntitySummaryNextStep;
    meta: EntitySummaryMeta;
}

export type EntitySummaryPayload = LeadSummaryPayload | DealSummaryPayload;

export type EntitySummaryEntityType = "lead" | "deal";

export interface EntityAiSummaryCardProps {
    entityType: EntitySummaryEntityType;
    entityId: number;
    initialSummary?: EntitySummaryPayload | null;
    variant?: "legacy" | "redesign";
    className?: string;
    leadPhone?: string | null;
    onQualifyLead?: () => void;
    onCreateTask?: () => void;
    onScheduleCall?: () => void;
    onRequestDocuments?: () => void;
    onAdvanceStage?: () => void;
    onReviewStaleDeal?: () => void;
}

export function isLeadSummaryPayload(
    summary: EntitySummaryPayload,
): summary is LeadSummaryPayload {
    return "primary_risk_source" in summary;
}
