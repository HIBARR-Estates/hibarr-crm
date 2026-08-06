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

export interface RegisterWebinarSessionPayload {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    leadId?: number;
    language?: string;
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
    startsAt: string;
    timezone?: string;
}

export interface GetNextWebinarSessionsResponse {
    success: boolean;
    data: WebinarSession[];
}

export interface RegisterWebinarSessionResponse {
    success: boolean;
    message?: string;
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

/** In-memory answer state keyed by segment_key */
export interface SegmentAnswerState {
    answer_values: string[];
    answer_text?: string | null;
}
