export interface SlaSettings {
    first_contact_sla_hours: number;
    min_hours: number;
    max_hours: number;
    default_hours: number;
}

export interface LeadSourceRow {
    id: number;
    type: string;
    sort_order: number;
    added_by: number | null;
}

export interface LeadSourcePermissions {
    add: boolean;
    edit: string;
    delete: string;
    reorder: boolean;
}

export interface LeadStatusRow {
    id: number;
    key: string;
    label: string;
    description: string | null;
    sort_order: number;
    label_color: string;
    leads_count: number;
    is_system: boolean;
    is_default: boolean;
}

export interface LeadStatusDraft {
    key: string;
    label: string;
    description: string;
    label_color: string;
    sort_order: number;
}

export interface LeadOriginRow {
    id: number;
    name: string;
    sort_order: number;
    leads_count: number;
}

export interface MarketingIntakeDepartment {
    id: number;
    name: string;
    members_count: number;
}

export interface MarketingIntakeSettings {
    department_ids: number[];
    origin_id: number;
    /** Default lead owner (user id) for leads saved through the flow; null = none. */
    owner_id: number | null;
    /** People who can own a lead (enabled lead agents). */
    owners: Array<{ id: number; name: string }>;
    departments: MarketingIntakeDepartment[];
}

export type FinancialKindRole = "income" | "asset" | "funding" | "commitment";
export type FinancialFrequency = "once" | "monthly" | "yearly";
export type FinancialCertainty = "confirmed" | "likely" | "uncertain";

export interface FinancialTypeRow {
    id: number;
    kind_id: number;
    key: string;
    label: string;
    default_frequency: FinancialFrequency | null;
    default_certainty: FinancialCertainty | null;
    sort_order: number;
    is_active: boolean;
    is_system: boolean;
    line_count: number;
}

export interface FinancialKindRow {
    id: number;
    key: string;
    label: string;
    role: FinancialKindRole;
    sort_order: number;
    is_active: boolean;
    is_system: boolean;
    types: FinancialTypeRow[];
}

export interface FinancialCryptoAssetRow {
    id: number;
    ticker: string;
    provider_id: string;
    name: string;
    is_active: boolean;
}

export interface FinancialAssessmentSettings {
    kinds: FinancialKindRow[];
    crypto_assets: FinancialCryptoAssetRow[];
    defaults: {
        reporting_currency: string;
        refresh_after_days: number;
        currencies: string[];
    };
    provider: { name: string | null; configured: boolean };
    options: {
        roles: FinancialKindRole[];
        frequencies: FinancialFrequency[];
        certainties: FinancialCertainty[];
    };
}

export interface FinancialRateTestResult {
    ok: boolean;
    ticker: string | null;
    rate: number | null;
    source: string | null;
    currency: string;
    reason: "no_api_key" | "no_assets" | "no_rate" | null;
}
