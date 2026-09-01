export interface LevelData {
    current_level: MlmLevel | null;
    next_level: MlmLevel | null;
    all_time_metrics: { nsa: number; nsd: number; vsa: number; vsd: number };
    cycle_metrics?: {
        nsa: number;
        nsd: number;
        vsa: number;
        vsd: number;
    } | null;
    enrollment?: {
        id: number;
        status: EnrollmentStatus;
        effective_start_date: string;
        effective_end_date: string;
        overflow_start_date?: string | null;
        max_overflow_date?: string | null;
        days_remaining: number;
        is_overflowing: boolean;
    } | null;
    active_cycle?: {
        cycle_number: number;
        end_date: string;
        days_remaining: number;
    } | null;
    criteria_progress: CriterionProgress[];
    level_history: AgentLevelHistory[];
}

// ── MLM Enums ────────────────────────────────────────────────────
export type MlmMetric = "nsa" | "nsd" | "vsa" | "vsd" | "nsa_nsd" | "vsa_vsd";
export type MlmCommissionType = "agent" | "upline" | "system";
export type MlmCommissionStatus = "pending" | "paid" | "reverted";
export type CriteriaOperator = ">=" | "<=" | "=" | ">" | "<";
// ── Cycle Enums ──────────────────────────────────────────────────
export type CycleDurationType = "monthly" | "quarterly" | "custom";
export type CycleStatus = "upcoming" | "active" | "completed";
export type EnrollmentStatus =
    | "active"
    | "extended"
    | "completed"
    | "force_completed";

export const CYCLE_DURATION_LABELS: Record<CycleDurationType, string> = {
    monthly: "Monthly (30 days)",
    quarterly: "Quarterly (90 days)",
    custom: "Custom",
};

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
    upcoming: "Upcoming",
    active: "Active",
    completed: "Completed",
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
    active: "Active",
    extended: "Extended (Overflow)",
    completed: "Completed",
    force_completed: "Force Completed",
};
export const MLM_METRIC_LABELS: Record<MlmMetric, string> = {
    nsa: "Number of Sales (Agent)",
    nsd: "Number of Sales (Downlines)",
    vsa: "Value of Sales (Agent)",
    vsd: "Value of Sales (Downlines)",
    nsa_nsd: "Total Sales Count (Agent + Downlines)",
    vsa_vsd: "Total Sales Value (Agent + Downlines)",
};

export const COMMISSION_STATUS_LABELS: Record<MlmCommissionStatus, string> = {
    pending: "Pending",
    paid: "Paid",
    reverted: "Reverted",
};

export const COMMISSION_TYPE_LABELS: Record<MlmCommissionType, string> = {
    agent: "Agent",
    upline: "Upline",
    system: "System",
};

// ── MLM Level ────────────────────────────────────────────────────
export interface MlmLevel {
    id: number;
    company_id: number;
    name: string;
    slug: string;
    rank: number;
    commission_percentage: number;
    direct_rate?: number;
    override_rate?: number;
    is_hidden?: boolean;
    created_at: string;
    updated_at: string;
    criteria?: MlmLevelCriterion[];
}

export interface MlmLevelFormData {
    name: string;
    rank: number;
    commission_percentage: number;
    direct_rate?: number;
    override_rate?: number;
    is_hidden?: boolean;
}

// ── Level Criteria ───────────────────────────────────────────────
export interface MlmLevelCriterion {
    id: number;
    mlm_level_id: number;
    logic_group: number;
    metric: MlmMetric;
    operator: CriteriaOperator;
    threshold: number;
    description?: string | null;
}

export interface MlmLevelCriterionFormData {
    mlm_level_id: number;
    logic_group: number;
    metric: MlmMetric;
    operator: CriteriaOperator;
    threshold: number;
    description?: string | null;
}

// ── Commission ───────────────────────────────────────────────────
export interface MlmCommission {
    id: number;
    company_id: number;
    deal_id: number;
    agent_id: number;
    source_agent_id: number;
    level_id: number | null;
    package_id: number | null;
    /** Null on a fixed-fee package leg — there is no percentage to show. */
    percentage: number | null;
    amount: number;
    type: MlmCommissionType;
    status: MlmCommissionStatus;
    paid_at: string | null;
    reverted_at: string | null;
    reverted_reason: string | null;
    created_at: string;
    updated_at: string;
    // Relationships (when loaded)
    deal?: {
        id: number;
        name: string;
        value: number;
        total_value: number;
    };
    agent?: AgentSummary;
    source_agent?: AgentSummary;
    level?: MlmLevel;
}

// ── Agent ────────────────────────────────────────────────────────
export interface AgentSummary {
    id: number;
    user_id: number;
    parent_agent_id: number | null;
    status: string;
    user?: {
        id: number;
        name: string;
        email: string;
        image: string | null;
        image_url: string | null;
    };
    current_level_history?: {
        id: number;
        level_id: number;
        assigned_at: string;
        level?: MlmLevel;
    };
}

// ── Agent Metrics ────────────────────────────────────────────────
export interface AgentMetric {
    id: number;
    company_id: number;
    agent_id: number;
    nsa: number;
    nsd: number;
    vsa: number;
    vsd: number;
    agent?: AgentSummary;
}

export interface AgentMetricWithProgress extends AgentMetric {
    current_level?: MlmLevel;
    next_level?: MlmLevel;
    progress_percentage?: number;
    criteria_progress?: CriterionProgress[];
}

export interface CriterionProgress {
    criterion: MlmLevelCriterion;
    current_value: number;
    target_value: number;
    met: boolean;
    percentage: number;
}

// ── Agent Level History ──────────────────────────────────────────
export interface AgentLevelHistory {
    id: number;
    company_id: number;
    agent_id: number;
    level_id: number;
    assigned_at: string;
    assigned_by: number | null;
    system_assigned: boolean;
    trigger_deal_id: number | null;
    agent?: AgentSummary;
    level?: MlmLevel;
    assigned_by_user?: { id: number; name: string };
    trigger_deal?: { id: number; name: string; value: number };
}

// ── Hierarchy Tree ───────────────────────────────────────────────
export interface AgentHierarchyNode {
    id: number;
    name: string;
    email?: string;
    image_url?: string | null;
    level_name?: string;
    level_rank?: number;
    total_sales?: number;
    total_downlines?: number;
    nsa?: number;
    nsd?: number;
    vsa?: number;
    vsd?: number;
    joined_date?: string;
    is_self?: boolean;
    is_upline?: boolean;
    children?: AgentHierarchyNode[];
}

// ── Commission Simulation ────────────────────────────────────────
export interface CommissionSimulationRequest {
    deal_value: number;
    agent_id: number;
}

export interface CommissionSimulationEntry {
    agent_name: string;
    agent_id: number;
    level_name: string;
    type: MlmCommissionType;
    percentage: number;
    amount: number;
}

export interface CommissionSimulationResult {
    entries: CommissionSimulationEntry[];
    total_distributed: number;
    system_commission: number;
    deal_value: number;
}

// ── Dashboard Stats ──────────────────────────────────────────────
export interface MlmAdminDashboardStats {
    total_agents: number;
    total_deals_won: number;
    total_commissions_paid: number;
    pending_commissions: number;
    total_commission_value: number;
    total_sales_value: number;
    top_agents: Array<
        AgentSummary & {
            total_earned: number;
            deals_count: number;
        }
    >;
    recent_promotions: AgentLevelHistory[];
    monthly_commissions: Array<{
        month: string;
        amount: number;
        count: number;
    }>;
}

export interface MlmAgentDashboardStats {
    current_level: MlmLevel | null;
    next_level: MlmLevel | null;
    progress_percentage: number;
    criteria_progress: CriterionProgress[];
    total_earnings: number;
    pending_earnings: number;
    paid_earnings: number;
    total_downlines: number;
    total_sales: number;
    total_sales_value: number;
    all_time_metrics?: {
        nsa: number;
        nsd: number;
        vsa: number;
        vsd: number;
    } | null;
    monthly_commissions: Array<{
        month: string;
        amount: number;
    }>;
    network_growth: Array<{
        month: string;
        count: number;
    }>;
    recent_commissions: MlmCommission[];
    // Cycle data
    enrollment?: {
        id: number;
        status: EnrollmentStatus;
        effective_start_date: string;
        effective_end_date: string;
        overflow_start_date: string | null;
        max_overflow_date: string | null;
        days_remaining: number;
        is_overflowing: boolean;
    } | null;
    cycle_metrics?: {
        nsa: number;
        nsd: number;
        vsa: number;
        vsd: number;
    } | null;
    active_cycle?: {
        cycle_number: number;
        start_date: string;
        end_date: string;
        days_remaining: number;
    } | null;
}

// ── Paginated Response ───────────────────────────────────────────
export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

// ── Commission & Cycle Settings ──────────────────────────────────
export interface MlmSettings {
    max_commission_percentage: number;
    auto_evaluate_ancestors: boolean;
    enable_commission_reversal: boolean;
    auto_generate_cycles: boolean;
    default_cycle_duration_type: CycleDurationType;
    default_cycle_duration_days: number | null;
    default_overflow_multiplier: number;
}

export interface AgentCommissionRateBounds {
    max_ceiling: number;
    is_highest_visible_level: boolean;
}

export interface AgentCommissionRateAuditLog {
    id: number;
    company_id: number;
    agent_id: number;
    changed_by_user_id: number | null;
    previous_direct_rate: number | null;
    new_direct_rate: number | null;
    previous_override_rate: number | null;
    new_override_rate: number | null;
    changed_at: string;
    reason: string | null;
    changed_by_user?: { id: number; name: string } | null;
}

export interface AgentCommissionProfile {
    agent_id: number;
    level: {
        id: number;
        name: string;
        rank: number;
        default_commission_rate: number;
    } | null;
    custom_commission_rate: number | null;
    bounds: AgentCommissionRateBounds;
    audit: PaginatedResponse<AgentCommissionRateAuditLog>;
}

export interface AgentCommissionProfileUpdatePayload {
    custom_commission_rate?: number | null;
    reason?: string | null;
}

// ── Cycle ────────────────────────────────────────────────────────
export interface MlmCycle {
    id: number;
    cycle_number: number;
    name: string;
    start_date: string;
    end_date: string;
    status: CycleStatus;
    duration_days: number;
    days_remaining: number;
    max_overflow_multiplier: number;
    enrollments_count?: number;
}

export interface MlmCycleFormData {
    name: string;
    start_date: string;
    end_date: string;
    max_overflow_multiplier?: number;
}

// ── Cycle Enrollment ─────────────────────────────────────────────
export interface AgentCycleEnrollment {
    id: number;
    agent_id: number;
    cycle_id: number;
    status: EnrollmentStatus;
    effective_start_date: string;
    effective_end_date: string;
    overflow_start_date: string | null;
    max_overflow_date: string | null;
    criteria_met_at: string | null;
    level_achieved_id: number | null;
    days_remaining: number;
    is_overflowing: boolean;
    agent_name?: string;
    agent_email?: string;
    level_achieved?: string;
    metrics?: {
        nsa: number;
        nsd: number;
        vsa: number;
        vsd: number;
    } | null;
}

// ── Active Cycle Summary ─────────────────────────────────────────
export interface ActiveCycleSummary {
    cycle: MlmCycle | null;
    default_overflow_multiplier: number;
    days_remaining: number;
    enrollment_count: number;
}

// ── My Enrollment Data ───────────────────────────────────────────
export interface MyEnrollmentData {
    enrollment: AgentCycleEnrollment | null;
    cycle: MlmCycle | null;
    cycle_metrics: {
        nsa: number;
        nsd: number;
        vsa: number;
        vsd: number;
    } | null;
    all_time_metrics: {
        nsa: number;
        nsd: number;
        vsa: number;
        vsd: number;
    } | null;
}

// ── Downline Deal Contribution ───────────────────────────────────
export interface DownlineDealContribution {
    deal_id: number;
    deal_name: string;
    closed_by: string;
    closed_by_self: boolean;
    deal_value: number;
    commission_amount: number;
    commission_type: string;
    date: string;
}

// ── Agent Invitation ─────────────────────────────────────────────
export type AgentInviteStatus = "pending" | "accepted" | "expired";

export interface AgentInvite {
    id: number;
    email: string;
    status: AgentInviteStatus;
    sent_at: string;
    accepted_at: string | null;
}

export interface SendInvitePayload {
    email: string;
}

// ── Downline List Item (for dropdown selector) ───────────────────
export interface DownlineListItem {
    id: number;
    name: string;
    email: string;
}
