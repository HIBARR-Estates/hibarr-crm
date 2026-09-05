export type AutomationScreen =
    | "overview"
    | "automations"
    | "builder"
    | "detail"
    | "templates"
    | "editor"
    | "metaEvents"
    | "logs";

export type SubjectType = "deal" | "lead";

export type TriggerKey =
    | "deal_created"
    | "deal_updated"
    | "followup_created"
    | "custom_field_updated"
    | "lead_created"
    | "lead_updated"
    | "lead_followup_created"
    | "date_based";

export type ActionType =
    | "stage_transition"
    | "set_field_value"
    | "lock_deal"
    | "send_email"
    | "create_task"
    | "create_note"
    | "meta_conversion"
    | "wait";

/** Exactly the operators ConditionEvaluatorService understands — "changed"
 * is accepted by the picker (parity with the Blade UI) but always evaluates
 * to false server-side today; a pre-existing gap, not something to fix here. */
export type ConditionOperator = "=" | ">" | "<" | "contains" | "exists" | "changed";

export type LogStatus = "success" | "failed" | "skipped";

export type LogChannel = "stage" | "field" | "lock" | "email" | "task" | "note" | "meta" | "wait";

export interface DealAutomationCondition {
    id?: number;
    field: string;
    operator: ConditionOperator;
    value: string | number | null;
}

export interface DealAutomationAction {
    id?: number;
    action_type: ActionType;
    target_stage_id: number | null;
    target_pipeline_id: number | null;
    forward_only: boolean;
    field_name: string | null;
    field_value: string | null;
    email_template_id: number | null;
    recipient_types: string[] | null;
    recipient_user_ids: number[] | null;
    recipient_emails: string | null;
    title: string | null;
    content: string | null;
    assignee_type: string | null;
    assignee_user_id: number | null;
    assigner_type: string | null;
    assigner_user_id: number | null;
    due_date_delta_value: number | null;
    due_date_delta_unit: string | null;
    due_time: string | null;
    meta_event_name: string | null;
    meta_event_value: number | null;
    wait_duration_value: number | null;
    wait_duration_unit: "minutes" | "hours" | "days" | null;
    targetStage?: { id: number; name: string } | null;
    emailTemplate?: { id: number; name: string } | null;
}

export interface Automation {
    id: number;
    name: string;
    subject_type: SubjectType;
    pipeline_id: number | null;
    trigger: TriggerKey | null;
    date_field: string | null;
    date_recurrence: "yearly" | "once" | null;
    wait_duration_value: number | null;
    wait_duration_unit: "minutes" | "hours" | "days" | null;
    active: boolean;
    priority: number;
    conditions: DealAutomationCondition[];
    actions: DealAutomationAction[];
}

export interface AutomationStat {
    runs: number;
    last_run_at: string | null;
}

export interface VariableMapping {
    variable: string;
    type: "field" | "cta_url";
    field?: string;
    cta_target?: string;
    cta_custom_url?: string | null;
}

export interface EmailTemplate {
    id: number;
    name: string;
    mode: "custom" | "plunk_body";
    subject: string;
    preheader: string | null;
    body: string;
    plunk_template_id: string | null;
    variable_mappings: VariableMapping[];
    automation_actions_count: number;
    updated_at: string;
}

export interface MetaEvent {
    id: number;
    name: string;
    value: number | null;
    description: string | null;
    using_automations: { id: number; name: string }[];
}

/** Which system actually delivered one automation email. "unknown" means the
 * send never reached UnsRoutingTransport (e.g. the array mail driver). */
export type MailSystem = "uns" | "smtp" | "unknown";

/** One recipient's outcome, as recorded by UnsRoutingTransport. */
export interface EmailDeliveryDetail {
    recipient: string;
    /** Ties this line to its row in email_delivery_logs. */
    correlation_id?: string;
    /** "unconfirmed" = the send raised no error but no transport outcome was
     * recorded, so delivery was never actually verified. */
    status: "sent" | "failed" | "unconfirmed";
    system: MailSystem;
    uns_attempted: boolean;
    response_status: number | null;
    response_body: string | null;
    /** Why UNS was skipped or abandoned in favour of the SMTP fallback. */
    fallback_reason: string | null;
    error: string | null;
}

/** Everything Meta's Conversions API said about one event. */
export interface MetaDeliveryDetail {
    success: boolean;
    event_name?: string;
    event_id?: string | null;
    value?: number;
    pixel_id?: string | null;
    api_version?: string;
    status_code?: number | null;
    events_received?: number | null;
    fbtrace_id?: string | null;
    error?: string | null;
    error_details?: Record<string, unknown> | null;
    response_body?: string | null;
}

/** Structured diagnostics on a log row — shape depends on `channel`. */
export interface RunLogDetails {
    /** meta rows: "queued" when the job was enqueued, "delivery" for the result. */
    stage?: "queued" | "delivery";
    source?: string;
    automation_name?: string | null;
    attempt?: number;
    // email
    template_id?: number;
    template_name?: string;
    plunk_template_id?: string | null;
    subject?: string;
    deliveries?: EmailDeliveryDetail[];
    // meta
    event_name?: string;
    value?: number;
    meta?: MetaDeliveryDetail;
    [key: string]: unknown;
}

/** One action performed inside a run — the log table's own row shape. */
export interface RunLogEntry {
    id: number;
    automation_id: number | null;
    /** The execution this step belongs to. */
    run_id: string | null;
    deal_id: number | null;
    lead_id: number | null;
    action: string;
    status: LogStatus;
    channel: LogChannel | null;
    /** Present on detail fetch; omitted from the run-history list payload. */
    details?: RunLogDetails | null;
    /** True when structured diagnostics exist and can be fetched on expand. */
    has_details?: boolean;
    executed_at: string;
    automation?: { id: number; name: string } | null;
    deal?: { id: number; name: string } | null;
    lead?: { id: number; client_name: string } | null;
}

/**
 * One execution of an automation, with every action it performed nested
 * under it. An automation with three actions produces one of these, not
 * three — `steps_count` is where the action count lives.
 */
export interface RunHistoryEntry {
    run_id: string;
    automation_id: number | null;
    /** Worst step status: any failed step makes the whole run failed. */
    status: LogStatus;
    steps_count: number;
    started_at: string | null;
    executed_at: string;
    steps: RunLogEntry[];
    automation?: { id: number; name: string } | null;
    deal?: { id: number; name: string } | null;
    lead?: { id: number; client_name: string } | null;
}

/** One deal/lead the automation actually fired for, with its own run tally. */
export interface AutomationFiredForRow {
    subject_type: "deal" | "lead";
    deal_id: number | null;
    lead_id: number | null;
    /** The record it ran against — a deal's name, or the lead's own name. */
    record_name: string | null;
    /** The person behind that record (a deal's linked contact). */
    person_name: string | null;
    person_email: string | null;
    /** Executions, not actions — a 3-action automation run once counts as 1. */
    runs: number;
    success_runs: number;
    /** Runs in which at least one action failed. */
    failed_runs: number;
    /** Actions performed across those runs. */
    total_steps: number;
    last_run_at: string | null;
}

export interface AutomationStatsSummary {
    total_runs: number;
    success_rate: number | null;
    last_run_at: string | null;
    runs_last_7_days: { day: string; value: number }[];
    /** Top records by run count — capped server-side (`fired_for_limit`). */
    fired_for: AutomationFiredForRow[];
    /** Distinct records overall, so the list can say "25 of 300". */
    fired_for_total: number;
}

export interface CustomFieldOption {
    id: number;
    label: string;
    type: string;
    values?: string | string[] | null;
}

export interface CatalogUser {
    id: number;
    name?: string;
    first_name?: string;
    last_name?: string;
}

/** Static option lists / lookups the builder + condition/template editors
 * need — mirrors AutomationFieldCatalog.php + a handful of model lookups,
 * deferred once via AutomationSettingController@index. */
export interface AutomationCatalog {
    pipelines: { id: number; name: string }[];
    stages: { id: number; name: string; lead_pipeline_id: number }[];
    users: CatalogUser[];
    dealCustomFields: CustomFieldOption[];
    leadCustomFields: CustomFieldOption[];
    leadCategories: { id: number; name: string }[];
    leadSources: { id: number; name: string }[];
    leadLifecycleStatuses: { id: number; name: string }[];
    leadAgents: { id: number; name: string | null }[];
    hibarrFields: Record<string, string>;
    /** lead_marketing columns — addressed as `lead_marketing_{key}`. */
    leadMarketingFields: Record<string, string>;
    /** Which of those are 0/1 flags, so the Value input offers Yes/No. */
    leadMarketingBooleanFields: string[];
    /**
     * Marketing identifiers usable in conditions but never in a merge tag —
     * they'd otherwise be emailable to any address. Enforced server-side in
     * DealAutomationService::resolveTagValue(); the picker just doesn't offer
     * them. See AutomationFieldCatalog::LEAD_MARKETING_CONDITION_ONLY_FIELDS.
     */
    leadMarketingConditionOnlyFields: string[];
    relatedFields: Record<string, string>;
    leadFields: Record<string, string>;
    leadSettableFields: Record<string, string>;
    dateFields: { lead: Record<string, string>; deal: Record<string, string> };
    dateRecurrences: Record<string, string>;
    dealActionTypes: ActionType[];
    leadActionTypes: ActionType[];
    assignmentTypes: Record<string, string>;
    recipientTypes: Record<string, { label: string; subject: "deal" | "lead" | "any" }>;
    dueDateDeltaUnits: Record<string, string>;
    waitDurationUnits: Record<string, string>;
    ctaTargets: Record<string, string>;
    templateModes: Record<string, string>;
}
