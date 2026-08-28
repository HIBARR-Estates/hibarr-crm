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

export interface RunLogEntry {
    id: number;
    automation_id: number;
    deal_id: number | null;
    lead_id: number | null;
    action: string;
    status: LogStatus;
    channel: LogChannel | null;
    executed_at: string;
    automation?: { id: number; name: string } | null;
    deal?: { id: number; name: string } | null;
    lead?: { id: number; client_name: string } | null;
}

export interface AutomationStatsSummary {
    total_runs: number;
    success_rate: number | null;
    last_run_at: string | null;
    runs_last_7_days: { day: string; value: number }[];
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
