export type PackageCommissionType = "percentage" | "fixed";

export interface PackageCommissionRow {
    id: number;
    name: string;
    value: number;
    /** The package's own price currency. NOT the currency the fee pays out in. */
    currency: string | null;
    commission_type: PackageCommissionType | null;
    commission_value: number | null;
    overrides_count: number;
}

export interface AgentOverride {
    agent_id: number;
    agent_name: string;
    commission_type: PackageCommissionType;
    commission_value: number;
}

export interface AgentOption {
    id: number;
    name: string;
    email: string | null;
}
