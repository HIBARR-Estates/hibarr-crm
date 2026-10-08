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
