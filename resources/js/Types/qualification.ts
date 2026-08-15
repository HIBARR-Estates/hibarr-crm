/**
 * Lead Qualification Types
 *
 * OL template tree types and CRM qualification session types.
 */

// ============================================================================
// OL Template Engine Types
// ============================================================================

export type SegmentType = "say" | "question" | "instruction" | "outcome";

export type AnswerType = "singleSelect" | "multiSelect" | "text" | "boolean";

/**
 * Optional role for question segments only (not the same as SegmentType).
 * Extensible; OL currently only accepts "main".
 */
export type QualificationQuestionCategory = "main";

export type QualificationOutcome =
    | "bookMeeting"
    | "inviteWebinar"
    | "callback"
    | "noFit";

export type QualificationStatus = "inProgress" | "completed" | "abandoned";

/** Placeholder tokens embedded in OL script text */
export type QualificationToken =
    | "{leadName}"
    | "{leadEmail}"
    | "{leadPhone}"
    | "{companyName}"
    | "{agentName}";

export const QUALIFICATION_TOKENS: QualificationToken[] = [
    "{leadName}",
    "{leadEmail}",
    "{leadPhone}",
    "{companyName}",
    "{agentName}",
];

export interface SegmentOption {
    id: string;
    key: string;
    label: string;
    sortOrder?: number;
}

export interface OutcomeMetadata {
    type: QualificationOutcome;
    calendlyUrl?: string;
    webinarId?: string;
    label?: string;
}

export type QualificationActionType =
    | "book_consultation"
    | "invite_webinar"
    | "schedule_callback"
    | "mark_no_fit"
    | "create_task"
    | "schedule_meeting"
    | "create_deal"
    | "add_note"
    | "log_activity"
    | "send_email"
    | "send_sms"
    | "assign_owner"
    | string;

export type QualificationActionCatalogStatus = "available" | "coming_soon";

export type QualificationActionRunStatus =
    | "pending"
    | "completed"
    | "failed"
    | "skipped"
    | "unavailable";

export interface QualificationActionRef {
    type: QualificationActionType;
    config?: Record<string, string>;
}

export interface QualificationActionCatalogEntry {
    type: QualificationActionType;
    label: string;
    status: QualificationActionCatalogStatus;
    requiresRuntimePayload: boolean;
    optionalConfigKeys: string[];
}

export interface QualificationActionRun {
    id: number;
    lead_qualification_id: number;
    action_type: QualificationActionType;
    status: QualificationActionRunStatus;
    config?: Record<string, string> | null;
    payload?: Record<string, unknown> | null;
    error?: string | null;
    completed_at?: string | null;
}

export interface Segment {
    key: string;
    type: SegmentType;
    label: string;
    sortOrder: number;
    parentOptionId?: string | null;
    answerType?: AnswerType;
    required?: boolean;
    options?: SegmentOption[];
    outcomeMetadata?: OutcomeMetadata;
    actions?: QualificationActionRef[];
    /**
     * Question-only role from OL. null/omit = no category.
     * Do not confuse with `type` (segment kind).
     */
    category?: QualificationQuestionCategory | null;
    isEntryQuestion?: boolean;
}

export interface TemplateTree {
    templateId: string;
    templateVersion: number;
    name: string;
    segments: Segment[];
    entryQuestionKey?: string;
}

export interface PublishedTemplate {
    id: string;
    name: string;
    version: number;
    description?: string;
}

export interface GetTemplatesResponse {
    success: boolean;
    data: PublishedTemplate[];
}

export interface GetTemplateTreeResponse {
    success: boolean;
    data: TemplateTree;
}

// ============================================================================
// OL Registration Types
// ============================================================================

export interface ConsultationCalendlyPayload {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    leadId?: number;
    calendlyUrl?: string;
    language?: string;
    country?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    gender?: string;
    utmInfo?: {
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        utmTerm?: string;
        utmContent?: string;
        agt?: number;
    };
}

/** Languages the OL webinar registration endpoint accepts. Note: no `ru`. */
export const WEBINAR_LANGUAGES = [
    "de",
    "en",
    "es",
    "fr",
    "it",
    "pt",
    "tr",
] as const;

export type WebinarLanguage = (typeof WEBINAR_LANGUAGES)[number];

export const WEBINAR_LANGUAGE_LABELS: Record<WebinarLanguage, string> = {
    de: "German",
    en: "English",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    pt: "Portuguese",
    tr: "Turkish",
};

export type WebinarGender = "male" | "female";

/**
 * Falls back to English for agent languages OL does not accept (e.g. `ru`,
 * which the qualification script offers but the registration enum rejects).
 */
export function toWebinarLanguage(language?: string | null): WebinarLanguage {
    const normalized = (language ?? "").toLowerCase();
    return (WEBINAR_LANGUAGES as readonly string[]).includes(normalized)
        ? (normalized as WebinarLanguage)
        : "en";
}

/** Mirrors `POST /v1/internal/registration/webinar/session/{sessionId}`. */
export interface RegisterWebinarSessionPayload {
    firstName: string;
    email: string;
    language: WebinarLanguage;
    lastName?: string | null;
    gender?: WebinarGender | null;
    phone?: string | null;
    utmInfo?: {
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        utmTerm?: string;
        utmContent?: string;
        agt?: number;
    } | null;
}

export interface ConsultationCalendlyResponse {
    success: boolean;
    message?: string;
    data?: {
        schedulingUrl?: string;
    };
}

export interface WebinarSession {
    id: string;
    title: string;
    /** Normalized from OL's `startDate`. */
    startsAt: string;
    timezone?: string;
    /** Minutes. */
    duration?: number;
    status?: string;
}

export interface GetNextWebinarSessionsResponse {
    success: boolean;
    data: WebinarSession[];
}

/**
 * Flattened result of a webinar registration. OL returns the join link and
 * topic in three places (`data`, `data.registrationMetadata`, and
 * `data.event.eventContent`); this keeps one canonical copy of each.
 */
export interface WebinarRegistrationResult {
    registrationId: number | null;
    webinarSessionId: number | null;
    leadId: number | null;
    /** Zoom join link for this registrant — the artifact worth persisting. */
    joinUrl: string | null;
    topic: string | null;
    /** OL/Zoom registrant identifier, needed to reconcile attendance later. */
    registrantId: string | null;
    /**
     * Start of the booked occurrence. Preferred over the series-level
     * `registrationMetadata.startTime`, which can point at a later date.
     */
    startsAt: string | null;
    isStartingSoon: boolean;
    hasAlreadyStarted: boolean;
}

export interface RegisterWebinarSessionResponse {
    success: boolean;
    message?: string;
    data: WebinarRegistrationResult | null;
}

// ============================================================================
// OL Service Configuration
// ============================================================================

export interface IOlConfig {
    baseUrl: string;
    apiKey: string;
    retryCount: number;
}

export const DEFAULT_OL_CONFIG: Omit<IOlConfig, "baseUrl" | "apiKey"> = {
    retryCount: 2,
};

export const MAX_OL_RETRY_COUNT = 5;

export class OlApiError extends Error {
    public readonly statusCode?: number;
    public readonly originalError?: Error;

    constructor(message: string, statusCode?: number, originalError?: Error) {
        super(message);
        this.name = "OlApiError";
        this.statusCode = statusCode;
        this.originalError = originalError;
    }
}

// ============================================================================
// CRM Qualification Types
// ============================================================================

export interface LeadQualificationAnswer {
    id: number;
    segment_key: string;
    answer_values: string[];
    answer_text?: string | null;
}

export interface LeadQualification {
    id: number;
    lead_id: number;
    agent_id: number;
    status: QualificationStatus;
    outcome?: QualificationOutcome | null;
    outcomes?: QualificationOutcome[];
    outcome_comment?: string | null;
    template_id: string;
    template_version: number;
    template_name?: string;
    agent_language: string;
    current_segment_key?: string | null;
    selected_branch_keys?: string[];
    completed_at?: string | null;
    created_at: string;
    updated_at: string;
    answers?: LeadQualificationAnswer[];
    action_runs?: QualificationActionRun[];
    agent?: {
        id: number;
        name: string;
        image?: string | null;
    };
}

export interface LeadQualificationsResponse {
    current: LeadQualification | null;
    history: LeadQualification[];
}

export interface StartQualificationPayload {
    template_id: string;
    template_version: number;
    template_name?: string;
    agent_language: string;
}

export interface UpsertAnswerPayload {
    segment_key: string;
    answer_values: string[];
    answer_text?: string | null;
}

export interface UpdateNavigationPayload {
    current_segment_key: string;
}

export interface CompleteQualificationPayload {
    outcomes: QualificationOutcome[];
    outcome_comment?: string | null;
    /** @deprecated Prefer outcomes[]; kept for transitional callers */
    outcome?: QualificationOutcome;
    selected_branch_keys?: string[];
    webinar_session_label?: string;
    actions?: QualificationActionRef[];
}

export interface ExecuteQualificationActionPayload {
    payload?: Record<string, unknown>;
    error?: string | null;
}

export interface ScriptOutcomeOption {
    key: QualificationOutcome;
    label: string;
    webinarId?: string;
    calendlyUrl?: string;
}

export const DEFAULT_OUTCOME_LABELS: Record<QualificationOutcome, string> = {
    bookMeeting: "Book consultation",
    inviteWebinar: "Invite to webinar",
    callback: "Schedule callback",
    noFit: "Not a fit",
};

/**
 * Lifecycle status key each outcome moves the lead to on completion.
 * Mirrors App\Enums\QualificationOutcome::lifecycleStatusKey() — keep in sync.
 */
export const OUTCOME_LIFECYCLE_STATUS_KEY: Record<QualificationOutcome, string> = {
    bookMeeting: "qualified",
    inviteWebinar: "nurturing",
    callback: "callback",
    noFit: "not_fit",
};

/** Past-tense labels for completed qualification review surfaces. */
export const COMPLETED_OUTCOME_LABELS: Record<QualificationOutcome, string> = {
    bookMeeting: "Consultation booked",
    inviteWebinar: "Webinar invited",
    callback: "Callback requested",
    noFit: "Not a fit",
};

/** Display / priority order for multi-select (matches CRM lifecycle policy). */
export const OUTCOME_PRIORITY: QualificationOutcome[] = [
    "bookMeeting",
    "inviteWebinar",
    "callback",
    "noFit",
];

export interface LeadLifecycleStatus {
    id: number;
    key: string;
    label: string;
    description?: string;
    label_color?: string;
    sort_order?: number;
}

/** Lead patch returned alongside a completed qualification (lifecycle + written fields). */
export interface QualificationLeadPatch {
    id: number;
    lead_lifecycle_status_id: number | null;
    lead_lifecycle_status?: LeadLifecycleStatus | null;
    lifecycleStatus?: LeadLifecycleStatus | null;
    /** Core / custom / category attributes written by the field mapping. */
    [key: string]: unknown;
}

/** In-memory answer state keyed by segment_key */
export interface SegmentAnswerState {
    answer_values: string[];
    answer_text?: string | null;
}
