import { useEffect, useRef } from "react";
import { Button, Icon, ModalShell, PanelHeader } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import useEmailRecordDrawer from "@/Email/hooks/useEmailRecordDrawer";
import type {
    EmailAddressRef,
    EmailComposerReplyContext,
    EmailDrawerMessage,
    EmailRecordRef,
} from "@/Email/types";

export interface EmailRecordDrawerProps {
    open: boolean;
    onClose: () => void;
    record: EmailRecordRef | null;
    messageId: string | null;
    onReply?: (reply: EmailComposerReplyContext) => void;
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

function replyContextFor(message: EmailDrawerMessage): EmailComposerReplyContext {
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
 * Record email drawer: conversation thread + exchanged attachments, with
 * deep-link focus on a specific message.
 */
export default function EmailRecordDrawer({
    open,
    onClose,
    record,
    messageId,
    onReply,
}: EmailRecordDrawerProps) {
    const { t, locale } = useTranslation();
    const messageRefs = useRef<Record<string, HTMLElement | null>>({});
    const {
        payload,
        loading,
        error,
        selectedMessage,
        selectedMessageId,
        selectMessage,
    } = useEmailRecordDrawer({ open, record, messageId });

    useEffect(() => {
        if (!open || !selectedMessageId) return;
        const node = messageRefs.current[selectedMessageId];
        node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [open, selectedMessageId, payload?.messages.length]);

    const title =
        payload?.conversation.subject?.trim() ||
        t("pages.email.drawer.title");

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            closeOnBackdrop
            ariaLabel={title}
            panelClassName="modal-panel"
            panelStyle={{
                maxWidth: "min(880px, 100%)",
                width: "100%",
                maxHeight: "min(900px, calc(100vh - 48px))",
                display: "flex",
                flexDirection: "column",
            }}
            initialFocus="panel"
            trapFocus
        >
            <PanelHeader
                title={title}
                        subtitle={
                    payload
                        ? t("pages.email.drawer.message_count").replace(
                              "{{count}}",
                              String(payload.conversation.message_count),
                          )
                        : undefined
                }
                onClose={onClose}
                closeAriaLabel={t("pages.email.drawer.close")}
            />

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-[22px] pb-5 pt-3">
                {loading ? (
                    <p className="m-0 text-sm text-dr-text-muted">
                        {t("pages.email.drawer.loading")}
                    </p>
                ) : error || !payload ? (
                    <p className="m-0 text-sm text-dr-text-muted" role="alert">
                        {t("pages.email.drawer.unavailable")}
                    </p>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs text-dr-text-muted">
                                {t("pages.email.drawer.oldest_newest_hint")}
                            </div>
                            {selectedMessage && onReply ? (
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

                        {selectedMessage ? (
                            <dl
                                className="m-0 rounded border border-dr-border bg-dr-surface-2 px-3 py-3 text-sm"
                                data-tour="email-drawer-header"
                            >
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
                                        value={formatAddressList(
                                            selectedMessage.cc,
                                        )}
                                    />
                                ) : null}
                                {selectedMessage.bcc &&
                                selectedMessage.bcc.length > 0 ? (
                                    <HeaderRow
                                        label={t("pages.email.drawer.bcc")}
                                        value={formatAddressList(
                                            selectedMessage.bcc,
                                        )}
                                    />
                                ) : null}
                                <HeaderRow
                                    label={t("pages.email.drawer.date")}
                                    value={formatWhen(
                                        selectedMessage.sent_at,
                                        locale,
                                    )}
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
                                {selectedMessage.files.length > 0 ? (
                                    <HeaderRow
                                        label={t("pages.email.drawer.files")}
                                        value={selectedMessage.files
                                            .map((file) => file.filename)
                                            .join(", ")}
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
                                    const selected =
                                        message.id === selectedMessageId;
                                    const isFirst = index === 0;
                                    const isLast =
                                        index ===
                                        payload.messages.length - 1;

                                    return (
                                        <li
                                            key={message.id}
                                            ref={(node) => {
                                                messageRefs.current[message.id] =
                                                    node;
                                            }}
                                            data-message-id={message.id}
                                            data-oldest={
                                                isFirst ? "true" : undefined
                                            }
                                            data-newest={
                                                isLast ? "true" : undefined
                                            }
                                        >
                                            <button
                                                type="button"
                                                className={`w-full border-0 border-b border-dr-border px-3 py-3 text-left transition-colors ${
                                                    selected
                                                        ? "bg-dr-blue-light"
                                                        : "bg-transparent hover:bg-dr-surface-2"
                                                }`}
                                                onClick={() =>
                                                    selectMessage(message.id)
                                                }
                                                aria-current={
                                                    selected
                                                        ? "true"
                                                        : undefined
                                                }
                                            >
                                                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-dr-text-muted">
                                                    <span>
                                                        {formatAddress(
                                                            message.from,
                                                        )}
                                                    </span>
                                                    <span>
                                                        {formatWhen(
                                                            message.sent_at,
                                                            locale,
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-medium text-dr-text">
                                                    {message.subject ||
                                                        t(
                                                            "pages.email.drawer.no_subject",
                                                        )}
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
                                                        {message.files.length >
                                                        0 ? (
                                                            <ul className="mt-3 list-none space-y-1 p-0">
                                                                {message.files.map(
                                                                    (file) => (
                                                                        <li
                                                                            key={
                                                                                file.id
                                                                            }
                                                                            className="flex items-center gap-2 text-xs text-dr-text-muted"
                                                                        >
                                                                            <Icon
                                                                                name="paperclip"
                                                                                size={
                                                                                    12
                                                                                }
                                                                            />
                                                                            {
                                                                                file.filename
                                                                            }
                                                                        </li>
                                                                    ),
                                                                )}
                                                            </ul>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>

                        <section
                            aria-label={t(
                                "pages.email.drawer.exchanged_attachments",
                            )}
                        >
                            <h3 className="mb-2 mt-0 text-sm font-semibold text-dr-text">
                                {t(
                                    "pages.email.drawer.exchanged_attachments",
                                )}
                            </h3>
                            {payload.exchanged_attachments.length === 0 ? (
                                <p className="m-0 text-sm text-dr-text-muted">
                                    {t(
                                        "pages.email.drawer.no_attachments",
                                    )}
                                </p>
                            ) : (
                                <ul className="m-0 list-none space-y-2 p-0">
                                    {payload.exchanged_attachments.map(
                                        (file) => (
                                            <li key={`${file.id}-${file.message_id}`}>
                                                <button
                                                    type="button"
                                                    className="flex w-full items-center justify-between gap-2 rounded border border-dr-border px-3 py-2 text-left text-sm hover:bg-dr-surface-2"
                                                    onClick={() => {
                                                        if (file.message_id) {
                                                            selectMessage(
                                                                file.message_id,
                                                            );
                                                        }
                                                    }}
                                                    data-file-message-id={
                                                        file.message_id
                                                    }
                                                >
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        <Icon
                                                            name="paperclip"
                                                            size={14}
                                                        />
                                                        <span className="truncate font-medium text-dr-text">
                                                            {file.filename}
                                                        </span>
                                                    </span>
                                                    <span className="shrink-0 text-xs text-dr-text-muted">
                                                        {formatWhen(
                                                            file.sent_at ??
                                                                null,
                                                            locale,
                                                        )}
                                                    </span>
                                                </button>
                                            </li>
                                        ),
                                    )}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </div>
        </ModalShell>
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
