import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { Button, Modal } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import ComposerEntryModal from "@/Email/ComposerEntryModal";
import EmailThreadPane from "@/Email/EmailThreadPane";
import { MAILBOX_SETTINGS_PATH } from "@/Email/mailboxSettings";
import useEmailTimelineGroups from "@/Email/hooks/useEmailTimelineGroups";
import type {
    EmailComposerReplyContext,
    EmailFollowUpKind,
    EmailRecordRef,
} from "@/Email/types";

export interface CommunicationModalProps {
    open: boolean;
    onClose: () => void;
    record: EmailRecordRef | null;
    recordLabel?: string | null;
    /** Timeline deep link. Null opens the latest thread. */
    messageId?: string | null;
    hasConnection: boolean;
    prefillTo?: string | null;
    onCreateFollowUp?: (kind: EmailFollowUpKind, messageId: string) => void;
}

/**
 * Lead/deal communication surface: conversation list, the selected email
 * thread, and a docked composer. Email is the only channel.
 */
export default function CommunicationModal({
    open,
    onClose,
    record,
    recordLabel,
    messageId = null,
    hasConnection,
    prefillTo,
    onCreateFollowUp,
}: CommunicationModalProps) {
    const { t } = useTranslation();
    const [focusId, setFocusId] = useState<string | null>(messageId);
    const [reply, setReply] = useState<EmailComposerReplyContext | null>(null);
    const [composing, setComposing] = useState(false);
    const [revision, setRevision] = useState(0);

    const { groups, addresses, loading, reload } = useEmailTimelineGroups({
        recordType: record?.type ?? "lead",
        recordId: record?.id ?? 0,
        enabled: open && record != null,
    });

    useEffect(() => {
        if (!open) {
            setComposing(false);
            setReply(null);
            setFocusId(null);
            return;
        }
        setFocusId(messageId);
    }, [open, messageId]);

    useEffect(() => {
        if (!open || focusId || groups.length === 0) return;
        setFocusId(groups[0].latest_message_id);
    }, [open, focusId, groups]);

    const startNew = () => {
        setReply(null);
        setComposing(true);
    };

    const startReply = (next: EmailComposerReplyContext) => {
        setReply(next);
        setComposing(true);
    };

    return (
        <Modal
            open={open}
            title={t("pages.email.communication.title")}
            subtitle={recordLabel || undefined}
            onClose={onClose}
            closeAriaLabel={t("pages.email.drawer.close")}
            maxWidth={1080}
        >
            <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-dr-blue-light px-2 py-0.5 text-xs font-medium text-dr-text">
                    {t("pages.email.communication.channel_email")}
                </span>
            </div>

            {!hasConnection ? (
                <div className="flex flex-col gap-3">
                    <p className="m-0 text-sm text-dr-text-muted">
                        {t("pages.email.communication.no_connection")}
                    </p>
                    <div>
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => router.visit(MAILBOX_SETTINGS_PATH)}
                        >
                            {t("pages.email.communication.open_settings")}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid min-h-[420px] grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
                    <section
                        className="min-h-0 overflow-y-auto"
                        aria-label={t("pages.email.communication.conversations")}
                    >
                        {loading ? (
                            <p className="m-0 text-sm text-dr-text-muted">
                                {t("pages.email.drawer.loading")}
                            </p>
                        ) : groups.length === 0 ? (
                            <p className="m-0 text-sm text-dr-text-muted">
                                {t("pages.email.communication.empty")}
                            </p>
                        ) : (
                            <ul className="m-0 list-none space-y-1 p-0">
                                {groups.map((group) => {
                                    const selected =
                                        group.latest_message_id === focusId ||
                                        group.messages.some(
                                            (message) => message.id === focusId,
                                        );
                                    return (
                                        <li key={group.id}>
                                            <button
                                                type="button"
                                                className={`w-full rounded border px-3 py-2 text-left text-sm ${
                                                    selected
                                                        ? "border-dr-blue bg-dr-blue-light"
                                                        : "border-dr-border bg-transparent hover:bg-dr-surface-2"
                                                }`}
                                                onClick={() => {
                                                    setFocusId(
                                                        group.latest_message_id,
                                                    );
                                                    setComposing(false);
                                                    setReply(null);
                                                }}
                                            >
                                                <div className="truncate font-medium text-dr-text">
                                                    {group.subject ||
                                                        t(
                                                            "pages.email.drawer.no_subject",
                                                        )}
                                                </div>
                                                <div className="text-xs text-dr-text-muted">
                                                    {t(
                                                        "pages.email.drawer.message_count",
                                                    ).replace(
                                                        "{{count}}",
                                                        String(
                                                            group.message_count,
                                                        ),
                                                    )}
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <div className="mt-3">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={startNew}
                            >
                                {t("pages.email.composer.new_title")}
                            </Button>
                        </div>
                    </section>

                    <section className="flex min-h-0 flex-col gap-3">
                        <EmailThreadPane
                            open={open}
                            record={record}
                            messageId={focusId}
                            revision={revision}
                            onReply={startReply}
                            onCreateFollowUp={onCreateFollowUp}
                        />
                        <ComposerEntryModal
                            open={composing}
                            variant="embedded"
                            onClose={() => {
                                setComposing(false);
                                setReply(null);
                            }}
                            recordLabel={recordLabel}
                            prefillTo={reply?.to?.[0] ?? prefillTo ?? null}
                            reply={reply}
                            enabled={hasConnection}
                            allowedAddresses={addresses}
                            record={record}
                            onManageMailbox={() =>
                                router.visit(MAILBOX_SETTINGS_PATH)
                            }
                            onSent={() => {
                                setComposing(false);
                                setReply(null);
                                setRevision((value) => value + 1);
                                void reload();
                            }}
                        />
                    </section>
                </div>
            )}
        </Modal>
    );
}
