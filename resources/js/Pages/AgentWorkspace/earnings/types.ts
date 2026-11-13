export type EarningsView = "overview" | "ledger" | "network";

export type CommissionStatus = "pending" | "paid" | "reverted";

export interface DisputeView {
    id: number;
    status: string;
    reason: string | null;
    message: string | null;
    created_at: string | null;
    resolved_at: string | null;
    resolution_note: string | null;
}

/** One commission line, as the Overview and Ledger list it. */
export interface CommissionLine {
    id: number;
    status: CommissionStatus;
    disputed: boolean;
    own: boolean;
    amount: number;
    created_at: string | null;
    deal_id: number | null;
    deal_name: string | null;
    lead_id: number | null;
    person: string | null;
    package: string | null;
    from_agent: string | null;
    dispute: DisputeView | null;
    can_dispute: boolean;
}

export interface EarningsSummary {
    earned_month: number;
    earned_prev_month: number;
    prev_month: string;
    pending_amount: number;
    pending_count: number;
    paid_year: number;
    paid_count: number;
    last_payout: string | null;
}

export interface LevelCriterion {
    metric: "nsa" | "nsd" | "vsa" | "vsd" | "nsa_nsd" | "vsa_vsd";
    /** Criteria sharing a group are alternatives; every group has to pass. */
    group: number;
    operator: string;
    current: number;
    target: number;
    met: boolean;
    percent: number;
}

export interface LevelCard {
    level: string | null;
    next_level: string | null;
    criteria: LevelCriterion[];
    cycle: { name: string | null; number: number | null; end_date: string | null } | null;
    enrollment: { status: string; days_remaining: number } | null;
}

export interface LedgerPayload {
    items: CommissionLine[];
    truncated: boolean;
}

export interface NetworkRow {
    id: number;
    name: string | null;
    kind: "upline" | "self" | "downline";
    depth: number;
    generation: number;
    level: string | null;
    direct: number;
    nsa: number;
    nsd: number;
    joined_at: string | null;
}

export interface NetworkPayload {
    rows: NetworkRow[];
    truncated: boolean;
}

export interface AgentPanelData {
    id: number;
    name: string | null;
    level: string | null;
    direct: number;
    metrics: { nsa: number; nsd: number; vsa: number; vsd: number };
    history: Array<{ assigned_at: string | null; level: string; system: boolean; joined: boolean; deal: string | null }>;
    deals: Array<{ id: number; deal_id: number | null; deal_name: string | null; deal_value: number | null; amount: number; created_at: string | null }>;
}
