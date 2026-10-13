import { useEffect, useRef } from "react";
import { Button } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import useEmailRecordDrawer from "@/Email/hooks/useEmailRecordDrawer";
import type {
    EmailAddressRef,
    EmailComposerReplyContext,
    EmailDrawerMessage,
    EmailFollowUpKind,
    EmailRecordRef,
} from "@/Email/types";

export interface EmailThreadPaneProps {
    open: boolean;
    record: EmailRecordRef | null;
    messageId: string | null;
    revision?: number;
    onReply?: (reply: EmailComposerReplyContext) => void;
    onCreateFollowUp?: (kind: EmailFollowUpKind, messageId: string) => void;
}

function formatAddress(address: EmailAddressRef | null | undefined): string {
    if (!address?.address) return "";
    return address.name
        ? `${address.name} <${address.address}>`
        : address.address;
}

function formatAddressList(list: EmailAddressRef[] | undefined): string {
    if (!list?.length) return "";
    return list.map((item) => formatAddress(item)).filter(Boolean).join(", ");
}

function formatWhen(value: string | null, locale: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export function replyContextFor(
    message: EmailDrawerMessage,
): EmailComposerReplyContext {
    const replyTo =
        message.direction === "outbound"
            ? (message.to[0]?.address ?? "")
            : (message.from?.address ?? "");

    const references = [
        ...(message.references ?? []),
        message.rfc_message_id,
    ].filter((id): id is string => Boolean(id));

    return {
        in_reply_to: message.rfc_message_id ?? message.id,
        references,
        subject: message.subject ?? undefined,
        to: replyTo ? [replyTo] : [],
    };
}

/**
 * Conversation thread for one record message: headers, dated messages,
 * and exchanged attachments. Used inside the Communication modal.
 */
export default function EmailThreadPane({
    open,
    record,
    messageId,
    revision = 0,
    onReply,
    onCreateFollowUp,
}: EmailThreadPaneProps) {
    const { t, locale } = useTranslation();
    const messageRefs = useRef<Record<string, HTMLElement | null>>({});
    const {
        payload,
        loading,
        error,
        selectedMessage,
        selectedMessageId,
        selectMessage,
    } = useEmailRecordDrawer({ open, record, messageId, revision });

    useEffect(() => {
        if (!open || !selectedMessageId) return;
        const node = messageRefs.current[selectedMessageId];
        node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [open, selectedMessageId, payload?.messages.length]);

    if (!messageId) {
        return (
            <p className="m-0 text-sm text-dr-text-muted">
                {t("pages.email.communication.empty")}
            </p>
        );
    }

    if (loading) {
        return (
            <p className="m-0 text-sm text-dr-text-muted">
                {t("pages.email.drawer.loading")}
            </p>
        );
    }

    if (error || !payload) {
        return (
            <p className="m-0 text-sm text-dr-text-muted" role="alert">
                {t("pages.email.drawer.unavailable")}
            </p>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-dr-text-muted">
                    {t("pages.email.drawer.oldest_newest_hint")}
                </div>
                {selectedMessage ? (
                    <div className="flex flex-wrap items-center gap-2">
                        {onCreateFollowUp ? (
                            <>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        onCreateFollowUp(
                                            "task",
                                            selectedMessage.id,
                                        )
                                    }
                                >
                                    {t("pages.email.drawer.create_task")}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        onCreateFollowUp(
                                            "note",
                                            selectedMessage.id,
                                        )
                                    }
                                >
                                    {t("pages.email.drawer.create_note")}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        onCreateFollowUp(
                                            "meeting",
                                            selectedMessage.id,
                                        )
                                    }
                                >
                                    {t("pages.email.drawer.create_meeting")}
                                </Button>
                            </>
                        ) : null}
                        {onReply ? (
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() =>
                                    onReply(replyContextFor(selectedMessage))
                                }
                            >
                                {t("pages.email.drawer.reply")}
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {selectedMessage ? (
                <dl className="m-0 rounded border border-dr-border bg-dr-surface-2 px-3 py-3 text-sm">
                    <HeaderRow
                        label={t("pages.email.drawer.from")}
                        value={formatAddress(selectedMessage.from)}
                    />
                    <HeaderRow
                        label={t("pages.email.drawer.to")}
                        value={formatAddressList(selectedMessage.to)}
                    />
                    {selectedMessage.cc.length > 0 ? (
                        <HeaderRow
                            label={t("pages.email.drawer.cc")}
                            value={formatAddressList(selectedMessage.cc)}
                        />
                    ) : null}
                    <HeaderRow
                        label={t("pages.email.drawer.date")}
                        value={formatWhen(selectedMessage.sent_at, locale)}
                    />
                    <HeaderRow
                        label={t("pages.email.drawer.subject")}
                        value={selectedMessage.subject ?? ""}
                    />
                    {selectedMessage.mailbox ? (
                        <HeaderRow
                            label={t("pages.email.drawer.mailbox")}
                            value={selectedMessage.mailbox.email}
                        />
                    ) : null}
                </dl>
            ) : null}

            <section
                className="min-h-0 flex-1 overflow-y-auto rounded border border-dr-border"
                aria-label={t("pages.email.drawer.conversation")}
            >
                <ol className="m-0 list-none space-y-0 p-0">
                    {payload.messages.map((message, index) => {
                        const selected = message.id === selectedMessageId;
                        return (
                            <li
                                key={message.id}
                                ref={(node) => {
                                    messageRefs.current[message.id] = node;
                                }}
                                data-message-id={message.id}
                                data-oldest={index === 0 ? "true" : undefined}
                                data-newest={
                                    index === payload.messages.length - 1
                                        ? "true"
                                        : undefined
                                }
                            >
                                <button
                                    type="button"
                                    className={`w-full border-0 border-b border-dr-border px-3 py-3 text-left ${
                                        selected
                                            ? "bg-dr-blue-light"
                                            : "bg-transparent hover:bg-dr-surface-2"
                                    }`}
                                    onClick={() => selectMessage(message.id)}
                                    aria-current={selected ? "true" : undefined}
                                >
                                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-dr-text-muted">
                                        <span>
                                            {formatAddress(message.from)}
                                        </span>
                                        <span>
                                            {formatWhen(message.sent_at, locale)}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-dr-text">
                                        {message.subject ||
                                            t("pages.email.drawer.no_subject")}
                                    </div>
                                    {selected ? (
                                        <div className="mt-3 border-t border-dr-border pt-3 text-sm text-dr-text">
                                            {message.html_body ? (
                                                <div
                                                    className="email-body max-w-none break-words"
                                                    dangerouslySetInnerHTML={{
                                                        __html: message.html_body,
                                                    }}
                                                />
                                            ) : (
                                                <pre className="m-0 whitespace-pre-wrap font-sans">
                                                    {message.text_body ||
                                                        t(
                                                            "pages.email.drawer.empty_body",
                                                        )}
                                                </pre>
                                            )}
                                        </div>
                                    ) : null}
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </section>
        </div>
    );
}

function HeaderRow({ label, value }: { label: string; value: string }) {
    if (!value) return null;
    return (
        <div className="grid grid-cols-[110px_1fr] gap-2 py-0.5">
            <dt className="text-dr-text-muted">{label}</dt>
            <dd className="m-0 min-w-0 break-words text-dr-text">{value}</dd>
        </div>
    );
}
