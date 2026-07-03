export type EntitySummaryRiskLevel = "none" | "low" | "medium" | "high";

export type EntitySummaryChipTone = "green" | "amber" | "red" | "neutral";

export type EntitySummaryActionType =
    | "CONTACT_LEAD"
    | "SCHEDULE_CALL"
    | "SEND_FOLLOWUP_EMAIL"
    | "QUALIFY_LEAD"
    | "REQUEST_MISSING_INFO"
    | "OPEN_DEAL"
    | "REVIEW_DEALS"
    | "ESCALATE_TO_MANAGER"
    | "NO_ACTION_NEEDED";

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
    target_deal_id: string | null;
    label: string;
    rationale: string;
    urgency: "immediate" | "this_week" | "routine";
}

export interface EntitySummaryMeta {
    generated_at: string;
    data_confidence: "high" | "medium" | "low";
    stale_data_warning?: boolean;
}

export interface EntitySummaryPayload {
    status_line: string;
    risk_level: EntitySummaryRiskLevel;
    primary_risk_source: EntitySummaryPrimaryRiskSource;
    chips: EntitySummaryChip[];
    bullets: string[];
    next_step: EntitySummaryNextStep;
    meta: EntitySummaryMeta;
}

export type EntitySummaryEntityType = "lead" | "deal";

export interface EntityAiSummaryCardProps {
    entityType: EntitySummaryEntityType;
    entityId: number;
    initialSummary?: EntitySummaryPayload | null;
    variant?: "legacy" | "redesign";
    className?: string;
    leadPhone?: string | null;
    onQualifyLead?: () => void;
}
