/** Shapes returned by lead-contact.financial.* (AssessmentPresenter::workspace). */

export type FinRole = "income" | "asset" | "funding" | "commitment";
export type FinFrequency = "once" | "monthly" | "yearly";
export type FinCertainty = "confirmed" | "likely" | "uncertain";
export type FinStatus = "draft" | "final" | "superseded";
export type FinSource =
    | "call"
    | "consultation"
    | "client_form"
    | "api"
    | "manual"
    | "import";

export interface FinRate {
    rate: number;
    source: string;
    fetched_at: string | null;
}

export interface FinLine {
    id: number;
    type_key: string;
    type_label: string;
    kind_key: string;
    kind_label: string;
    role: FinRole;
    amount: number;
    currency: string;
    frequency: FinFrequency;
    certainty: FinCertainty;
    available_from: string | null;
    contributor_label: string | null;
    contributor_lead_id: number | null;
    proof_file_id: number | null;
    note: string | null;
    converted_amount: number | null;
    rate: number | null;
    previous_line_id: number | null;
    previous: {
        amount: number;
        currency: string;
        frequency: FinFrequency;
        certainty: FinCertainty;
    } | null;
}

export interface FinTotals {
    calc_version: number;
    base_currency: string;
    as_of: string;
    income_monthly: number;
    uncertain_income_monthly: number;
    commitments_monthly: number;
    disposable_monthly: number;
    assets_total: number;
    funding_total: number;
    computed_available_now: number;
    available_now_override: number | null;
    available_now: number;
    available_projected: number;
    uncertain_total: number;
    by_kind: Record<string, { role: FinRole; counted: number; uncertain: number }>;
    by_type: Record<string, { counted: number; uncertain: number }>;
    rates?: Record<string, FinRate>;
    rates_as_of?: string;
    line_count?: number;
}

export interface FinPerson {
    id: number;
    name: string;
}

export interface FinAssessment {
    id: number;
    status: FinStatus;
    source: FinSource;
    as_of_date: string;
    currency: string;
    notes: string | null;
    finalised_at: string | null;
    verified_at: string | null;
    verified_by: FinPerson | null;
    prepared_by: FinPerson | null;
    available_now_override: number | null;
    override_reason: string | null;
    supersedes_assessment_id: number | null;
    /** Frozen at finalise; null for a draft. */
    totals: FinTotals | null;
    lines: FinLine[];
}

export interface FinDraft extends FinAssessment {
    preview: { totals: FinTotals | null; missing_rates: string[] };
    rates: Record<string, FinRate>;
}

export interface FinSummary {
    currency: string;
    as_of_date: string;
    finalised_at: string | null;
    refresh_due_on: string | null;
    days_until_due: number | null;
    is_refresh_due: boolean;
    verified: boolean;
    verified_at: string | null;
    available_now: number;
    available_now_overridden: boolean;
    available_projected: number;
    uncertain_total: number;
    income_monthly: number;
    commitments_monthly: number;
    disposable_monthly: number;
}

export interface FinTypeOption {
    key: string;
    label: string;
    default_frequency: FinFrequency | null;
    default_certainty: FinCertainty | null;
}

export interface FinKindOption {
    key: string;
    label: string;
    role: FinRole;
    types: FinTypeOption[];
}

export interface FinWorkspace {
    permissions: { view: boolean; edit: boolean };
    summary: FinSummary | null;
    current: FinAssessment | null;
    draft: FinDraft | null;
    history: FinAssessment[];
    options: {
        kinds: FinKindOption[];
        fiat_currencies: string[];
        crypto_currencies: string[];
    };
    settings: {
        reporting_currency: string;
        refresh_after_days: number;
        crypto_provider_ready: boolean;
    };
}

export interface FinLineInput {
    amount?: number | string;
    currency?: string;
    frequency?: FinFrequency;
    certainty?: FinCertainty;
    available_from?: string | null;
    contributor_label?: string | null;
    proof_file_id?: number | null;
    note?: string | null;
}

export interface FinFinaliseInput {
    manual_rates?: Record<string, number>;
    available_now_override?: number | null;
    override_reason?: string | null;
}

/** A refused action: the reason code from the server plus, for finalise, the currencies lacking a rate. */
export interface FinFailure {
    message: string;
    reason: string | null;
    missingRates: string[];
}
