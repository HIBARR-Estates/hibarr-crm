/** Server gate for the Email Quick action (flag + allowlist). Null → hide. */
export type EmailQuickAction = {
    has_connection: boolean;
};

export type EmailSignature = {
    text: string | null;
    html: string | null;
    has_content: boolean;
};

export type EmailConnectionSummary = {
    id: string;
    provider: string;
    identity_email: string;
    from_email: string;
    reply_to_email: string | null;
    status: string;
    signature: EmailSignature;
};

export type EmailComposerAttachment = {
    id: string;
    filename: string;
    mime_type: string | null;
    size_bytes: number | null;
    scan_status: string;
    downloadable: boolean;
};

/** CRM follow-up created from a specific email message (E-32). */
export type EmailFollowUpKind = "task" | "note" | "meeting";

export type EmailComposerReplyContext = {
    in_reply_to: string;
    references?: string[];
    subject?: string;
    to?: string[];
};

export type EmailSendAttemptResult = {
    id: string;
    status: "sending" | "sent" | "failed" | "checking" | "waiting_quota";
    error_code: string | null;
    sent_at: string | null;
    is_reply: boolean;
    draft: {
        to: string[];
        cc: string[];
        subject: string;
        text_body: string | null;
        html_body: string | null;
        in_reply_to: string | null;
        references: string[];
        attachment_count: number;
    };
};

export type EmailAddressRef = {
    address: string;
    name?: string | null;
};

export type EmailDrawerFile = EmailComposerAttachment & {
    message_id?: string;
    sent_at?: string | null;
    subject?: string | null;
};

export type EmailDrawerMessage = {
    id: string;
    conversation_id: string;
    copy_id: string | null;
    unread: boolean;
    direction: string | null;
    from: EmailAddressRef | null;
    to: EmailAddressRef[];
    cc: EmailAddressRef[];
    bcc?: EmailAddressRef[];
    subject: string | null;
    sent_at: string | null;
    text_body: string | null;
    html_body: string | null;
    has_attachments: boolean;
    files: EmailComposerAttachment[];
    mailbox: { id: string; email: string } | null;
    rfc_message_id: string | null;
    in_reply_to: string | null;
    references: string[];
};

export type EmailConversationDrawerPayload = {
    conversation: {
        id: string;
        subject: string | null;
        message_count: number;
    };
    messages: EmailDrawerMessage[];
    exchanged_attachments: EmailDrawerFile[];
    focus_message_id: string | null;
};

export type EmailRecordRef = {
    type: "lead" | "deal";
    id: number;
};

export type EmailTimelineSendStatus =
    | "sending"
    | "sent"
    | "failed"
    | "checking"
    | "waiting_quota";

export type EmailTimelineMessage = {
    id: string;
    subject: string | null;
    sent_at: string | null;
    direction: string | null;
    preview: string | null;
    unread: boolean;
    send_status: EmailTimelineSendStatus | null;
};

export type EmailTimelineGroup = {
    id: string;
    subject: string | null;
    latest_sent_at: string | null;
    latest_direction: string | null;
    latest_message_id: string;
    message_count: number;
    unread_count: number;
    status: EmailTimelineSendStatus | null;
    preview: string | null;
    messages: EmailTimelineMessage[];
};

export type EmailTimelineGroupsResponse = {
    groups: EmailTimelineGroup[];
};

export type EmailHandoffRef = {
    id: string;
    type: "handoff" | "escalate";
    status: "pending" | "accepted" | "rejected";
    note?: string | null;
    to_user?: { id: number; name: string } | null;
    from_user?: { id: number; name: string } | null;
    created_at?: string | null;
    copy_id?: string | null;
    subject?: string | null;
    from?: EmailAddressRef | null;
    sent_at?: string | null;
    preview?: string | null;
};

export type EmailHandoffColleague = {
    id: number;
    name: string;
    email: string | null;
};

export type EmailReviewItem = {
    id: string;
    message_uuid: string | null;
    unread: boolean;
    connection_id: string | null;
    direction: string;
    folder: string | null;
    review_status?: string;
    from: EmailAddressRef | null;
    to: EmailAddressRef[];
    cc: EmailAddressRef[];
    subject: string | null;
    sent_at: string | null;
    preview: string | null;
    has_attachments: boolean;
    files: EmailComposerAttachment[];
    record_exists: boolean;
    snippet?: string | null;
    handoff?: EmailHandoffRef | null;
};

export type EmailReviewMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};

export type EmailAttachCandidate = {
    record_type: "lead" | "deal";
    record_id: number;
    label: string;
    email: string | null;
};

export type EmailWorkReportMailbox = {
    connection_id: string;
    email: string;
    owner_id: number | null;
    owner_name: string | null;
};

export type EmailWorkReportItem = {
    id: string;
    kind:
        | "pending_routing"
        | "open_follow_up"
        | "unresolved_handoff"
        | "sync_fault"
        | "delivery_fault";
    label: string | null;
    since: string;
    age_seconds: number;
    mailbox: EmailWorkReportMailbox | null;
    href: string | null;
    handoff_type?: string;
    from_user?: { id: number; name: string } | null;
    to_user?: { id: number; name: string } | null;
    connection_status?: string;
    send_status?: string;
    error_code?: string | null;
};

export type EmailWorkReportCounts = {
    pending_routing: number;
    open_follow_ups: number;
    unresolved_handoffs: number;
    faults: number;
};

export type EmailWorkReportSections = {
    pending_routing: EmailWorkReportItem[];
    open_follow_ups: EmailWorkReportItem[];
    unresolved_handoffs: EmailWorkReportItem[];
    faults: EmailWorkReportItem[];
};
