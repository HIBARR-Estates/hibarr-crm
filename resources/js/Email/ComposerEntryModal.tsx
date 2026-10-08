import { useRef } from "react";
import { Button, Icon, Modal, ModalField } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import useEmailComposer from "@/Email/hooks/useEmailComposer";
import type { EmailComposerReplyContext } from "@/Email/types";

export interface ComposerEntryModalProps {
    open: boolean;
    onClose: () => void;
    /** Record the draft is being written against (lead or deal name). */
    recordLabel?: string | null;
    /** Prefill To for a new message (e.g. lead client_email). */
    prefillTo?: string | null;
    /** When set, compose as a reply (In-Reply-To / References). */
    reply?: EmailComposerReplyContext | null;
    enabled?: boolean;
    onSent?: () => void;
}

function formatBytes(bytes: number | null): string {
    if (bytes == null || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Lead/deal Email composer: new + reply. From / Reply-To come from the
 * connection; signature is previewed once and appended once at send.
 */
export default function ComposerEntryModal({
    open,
    onClose,
    recordLabel,
    prefillTo,
    reply = null,
    enabled = true,
    onSent,
}: ComposerEntryModalProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isReply = Boolean(reply?.in_reply_to);

    const {
        connections,
        selectedConnection,
        loadingConnections,
        form,
        updateForm,
        sending,
        uploading,
        errorCode,
        lastAttempt,
        hasInvalidAttachment,
        uploadFiles,
        removeAttachment,
        send,
    } = useEmailComposer({
        open,
        enabled: enabled && open,
        prefillTo,
        reply,
    });

    const dirty =
        Boolean(form.to.trim()) ||
        Boolean(form.cc.trim()) ||
        Boolean(form.subject.trim()) ||
        Boolean(form.body.trim()) ||
        form.attachments.length > 0;

    const statusLabel =
        lastAttempt?.status === "sent"
            ? t("pages.email.composer.status_sent")
            : lastAttempt?.status === "waiting_quota"
              ? t("pages.email.composer.status_waiting")
              : lastAttempt?.status === "checking"
                ? t("pages.email.composer.status_checking")
                : lastAttempt?.status === "failed"
                  ? t("pages.email.composer.status_failed")
                  : null;

    const errorMessage = errorCode
        ? t(`pages.email.composer.errors.${errorCode}`, {
              defaultValue: t("pages.email.composer.errors.generic"),
          })
        : null;

    const handleClose = () => {
        if (sending) return;
        onClose();
    };

    const handleSend = async () => {
        const attempt = await send();
        if (attempt?.status === "sent") {
            onSent?.();
            onClose();
        }
    };

    const signature = selectedConnection?.signature;
    const showSignaturePreview =
        form.includeSignature && signature?.has_content === true;

    return (
        <Modal
            open={open}
            title={
                isReply
                    ? t("pages.email.composer.reply_title")
                    : t("pages.email.composer.new_title")
            }
            subtitle={recordLabel || undefined}
            onClose={handleClose}
            closeAriaLabel={t("pages.email.composer.close")}
            dirty={dirty && lastAttempt?.status !== "sent"}
            maxWidth={720}
            footer={
                <>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClose}
                        disabled={sending}
                    >
                        {t("pages.email.composer.cancel")}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => void handleSend()}
                        disabled={
                            sending ||
                            uploading ||
                            loadingConnections ||
                            !selectedConnection ||
                            hasInvalidAttachment
                        }
                        loading={sending}
                    >
                        {t("pages.email.composer.send")}
                    </Button>
                </>
            }
        >
            {loadingConnections ? (
                <p className="m-0 text-sm text-dr-text-muted">
                    {t("pages.email.composer.loading")}
                </p>
            ) : !selectedConnection ? (
                <p className="m-0 text-sm text-dr-text-muted">
                    {t("pages.email.composer.no_active_connection")}
                </p>
            ) : (
                <div className="flex flex-col gap-1">
                    {connections.length > 1 ? (
                        <ModalField label={t("pages.email.composer.from")}>
                            <select
                                className="dr-input w-full"
                                value={form.connectionId}
                                disabled={sending}
                                onChange={(event) =>
                                    updateForm({
                                        connectionId: event.target.value,
                                    })
                                }
                                aria-label={t("pages.email.composer.from")}
                            >
                                {connections.map((connection) => (
                                    <option
                                        key={connection.id}
                                        value={connection.id}
                                    >
                                        {connection.from_email}
                                    </option>
                                ))}
                            </select>
                        </ModalField>
                    ) : (
                        <ModalField label={t("pages.email.composer.from")}>
                            <input
                                className="dr-input w-full"
                                value={selectedConnection.from_email}
                                readOnly
                                aria-readonly="true"
                            />
                        </ModalField>
                    )}

                    {selectedConnection.reply_to_email ? (
                        <ModalField label={t("pages.email.composer.reply_to")}>
                            <input
                                className="dr-input w-full"
                                value={selectedConnection.reply_to_email}
                                readOnly
                                aria-readonly="true"
                            />
                        </ModalField>
                    ) : null}

                    <ModalField label={t("pages.email.composer.to")}>
                        <input
                            className="dr-input w-full"
                            value={form.to}
                            disabled={sending}
                            autoFocus
                            onChange={(event) =>
                                updateForm({ to: event.target.value })
                            }
                            placeholder={t(
                                "pages.email.composer.to_placeholder",
                            )}
                            aria-label={t("pages.email.composer.to")}
                        />
                    </ModalField>

                    <ModalField label={t("pages.email.composer.cc")}>
                        <input
                            className="dr-input w-full"
                            value={form.cc}
                            disabled={sending}
                            onChange={(event) =>
                                updateForm({ cc: event.target.value })
                            }
                            placeholder={t(
                                "pages.email.composer.cc_placeholder",
                            )}
                            aria-label={t("pages.email.composer.cc")}
                        />
                    </ModalField>

                    <ModalField label={t("pages.email.composer.subject")}>
                        <input
                            className="dr-input w-full"
                            value={form.subject}
                            disabled={sending}
                            onChange={(event) =>
                                updateForm({ subject: event.target.value })
                            }
                            aria-label={t("pages.email.composer.subject")}
                        />
                    </ModalField>

                    <ModalField label={t("pages.email.composer.body")}>
                        <textarea
                            className="dr-input w-full"
                            value={form.body}
                            disabled={sending}
                            rows={8}
                            onChange={(event) =>
                                updateForm({ body: event.target.value })
                            }
                            placeholder={t(
                                "pages.email.composer.body_placeholder",
                            )}
                            aria-label={t("pages.email.composer.body")}
                        />
                    </ModalField>

                    {signature?.has_content ? (
                        <div className="mb-4">
                            <label className="mb-2 flex items-center gap-2 text-sm text-dr-text">
                                <input
                                    type="checkbox"
                                    checked={form.includeSignature}
                                    disabled={sending}
                                    onChange={(event) =>
                                        updateForm({
                                            includeSignature:
                                                event.target.checked,
                                        })
                                    }
                                />
                                {t("pages.email.composer.include_signature")}
                            </label>
                            {showSignaturePreview ? (
                                <div
                                    className="rounded border border-dr-border bg-dr-surface-2 px-3 py-2 text-sm text-dr-text-muted"
                                    aria-label={t(
                                        "pages.email.composer.signature_preview",
                                    )}
                                >
                                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-dr-text-hint">
                                        {t(
                                            "pages.email.composer.signature_preview",
                                        )}
                                    </div>
                                    {signature.html ? (
                                        <div
                                            className="prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{
                                                __html: signature.html,
                                            }}
                                        />
                                    ) : (
                                        <pre className="m-0 whitespace-pre-wrap font-sans">
                                            {signature.text}
                                        </pre>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="mb-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-sm text-dr-text">
                                {t("pages.email.composer.attachments")}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={sending || uploading}
                                loading={uploading}
                                onClick={() => fileInputRef.current?.click()}
                                icon={<Icon name="paperclip" size={14} />}
                            >
                                {t("pages.email.composer.attach")}
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                multiple
                                onChange={(event) => {
                                    if (event.target.files?.length) {
                                        void uploadFiles(event.target.files);
                                        event.target.value = "";
                                    }
                                }}
                            />
                        </div>
                        {form.attachments.length > 0 ? (
                            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                                {form.attachments.map((file) => (
                                    <li
                                        key={file.id}
                                        className="flex items-center justify-between gap-2 rounded border border-dr-border px-3 py-2 text-sm"
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate font-medium text-dr-text">
                                                {file.filename}
                                            </div>
                                            <div className="text-xs text-dr-text-muted">
                                                {[
                                                    formatBytes(
                                                        file.size_bytes,
                                                    ),
                                                    file.downloadable
                                                        ? null
                                                        : t(
                                                              "pages.email.composer.attachment_blocked",
                                                          ),
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={sending}
                                            onClick={() =>
                                                removeAttachment(file.id)
                                            }
                                            aria-label={t(
                                                "pages.email.composer.remove_attachment",
                                            )}
                                        >
                                            {t(
                                                "pages.email.composer.remove_attachment",
                                            )}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>

                    {errorMessage ? (
                        <p
                            className="m-0 text-sm text-red-600"
                            role="alert"
                        >
                            {errorMessage}
                        </p>
                    ) : null}

                    {statusLabel && lastAttempt ? (
                        <p
                            className="m-0 text-sm text-dr-text-muted"
                            role="status"
                        >
                            {statusLabel}
                            {lastAttempt.status === "sent"
                                ? ` — ${t("pages.email.composer.not_delivered")}`
                                : null}
                        </p>
                    ) : null}
                </div>
            )}
        </Modal>
    );
}
