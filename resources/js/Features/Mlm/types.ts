// ── MLM Enums ────────────────────────────────────────────────────
export type MlmMetric = "nsa" | "nsd" | "vsa" | "vsd" | "nsa_nsd" | "vsa_vsd";
export type MlmCommissionType = "agent" | "upline" | "system";
export type MlmCommissionStatus = "pending" | "paid" | "reverted";
export type CriteriaOperator = ">=" | "<=" | "=" | ">" | "<";

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
    created_at: string;
    updated_at: string;
    criteria?: MlmLevelCriterion[];
}

export interface MlmLevelFormData {
    name: string;
    rank: number;
    commission_percentage: number;
}

// ── Level Criteria ───────────────────────────────────────────────
export interface MlmLevelCriterion {
    id: number;
    mlm_level_id: number;
    logic_group: number;
    metric: MlmMetric;
    operator: CriteriaOperator;
    threshold: number;
}

export interface MlmLevelCriterionFormData {
    mlm_level_id: number;
    logic_group: number;
    metric: MlmMetric;
    operator: CriteriaOperator;
    threshold: number;
}

// ── Commission ───────────────────────────────────────────────────
export interface MlmCommission {
    id: number;
    company_id: number;
    deal_id: number;
    agent_id: number;
    source_agent_id: number;
    level_id: number | null;
    percentage: number;
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
    monthly_commissions: Array<{
        month: string;
        amount: number;
    }>;
    network_growth: Array<{
        month: string;
        count: number;
    }>;
    recent_commissions: MlmCommission[];
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

// ── Commission Settings ──────────────────────────────────────────
export interface MlmSettings {
    max_commission_percentage: number;
    auto_evaluate_ancestors: boolean;
    enable_commission_reversal: boolean;
}
