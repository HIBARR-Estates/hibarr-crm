/**
 * "none" is a configured zero — distinct from a package's commission_type
 * being null, which means "no setting at all, fall through to the level-based
 * split". A "none" package (or override) pays nothing and does not fall
 * through.
 */
export type PackageCommissionType = "percentage" | "fixed" | "none";

export interface PackageRow {
    id: number;
    name: string;
    value: number;
    /** The package's own price currency. NOT the currency the fee pays out in. */
    currency: string | null;
    description: string | null;
    customer_type_name: string | null;
    customer_type_description: string | null;
    pipeline_id: number | null;
    default_stage_id: number | null;
    commission_type: PackageCommissionType | null;
    commission_value: number | null;
    overrides_count: number;
    routing_triggers_count: number;
}

export type RoutingMatchMode = "exact" | "present";

export interface RoutingTrigger {
    field_key: string;
    match_mode: RoutingMatchMode;
    match_value: string | null;
}

export interface RoutingFieldOption {
    value: string;
    label: string;
    /** Was selected on this package before its field got disabled for routing. */
    stale?: boolean;
}

/** The writable shape of a package, as the create/edit dialog holds it. */
export interface PackageFormValues {
    name: string;
    value: number | null;
    currency: string;
    description: string;
    customer_type_name: string;
    customer_type_description: string;
    pipeline_id: number | null;
    default_stage_id: number | null;
    commission_type: PackageCommissionType | null;
    commission_value: number | null;
    routing_triggers: RoutingTrigger[];
}

/**
 * One agent's row on one package. It holds what they earn as the closer and, with
 * the referral feature on, what they earn as the referrer, so an agent who is
 * both is set up, and read, in one place.
 */
export interface AgentOverride {
    agent_id: number;
    agent_name: string;
    /** Null: no closer override, the package default applies. */
    commission_type: PackageCommissionType | null;
    /** Null when commission_type is "none" or unset — there is nothing to store. */
    commission_value: number | null;
    /** Served only with the referral feature on. Null: no referral terms. */
    referral_commission_type?: PackageCommissionType | null;
    referral_commission_value?: number | null;
}

/** One role's rule as the editor holds it. A null type means "not set". */
export interface CommissionRule {
    type: PackageCommissionType | null;
    value: number | null;
}

export interface AgentOption {
    id: number;
    name: string;
    email: string | null;
}

export interface PipelineOption {
    id: number;
    name: string;
}

export interface StageOption {
    id: number;
    name: string;
    lead_pipeline_id: number;
}
