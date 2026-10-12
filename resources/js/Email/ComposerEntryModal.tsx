import { useRef } from "react";
import { Button, Icon, Modal, ModalField } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import useEmailComposer from "@/Email/hooks/useEmailComposer";
import type {
    EmailComposerReplyContext,
    EmailKnownAddress,
    EmailRecordRef,
} from "@/Email/types";

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
    /** Lead addresses this send may use. */
    allowedAddresses?: EmailKnownAddress[] | null;
    record?: EmailRecordRef | null;
    /** Open mailbox connection settings (stop / reconnect / connect). */
    onManageMailbox?: () => void;
    /** Dock the form in a parent surface instead of a modal. */
    variant?: "modal" | "embedded";
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
    onManageMailbox,
    variant = "modal",
    allowedAddresses = null,
    record = null,
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
        allowedAddresses,
        record,
    });

    const dirty =
        form.to.length > 0 ||
        form.cc.length > 0 ||
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

    const actions = (
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
    );

    const form = (
        <>
            {loadingConnections ? (
                <p className="m-0 text-sm text-dr-text-muted">
                    {t("pages.email.composer.loading")}
                </p>
            ) : !selectedConnection ? (
                <div className="flex flex-col gap-3">
                    <p className="m-0 text-sm text-dr-text-muted">
                        {t("pages.email.composer.no_active_connection")}
                    </p>
                    <p className="m-0 text-sm text-dr-text-muted">
                        {t("pages.email.connect.waiting_to_send_hint")}
                    </p>
                    {onManageMailbox ? (
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={onManageMailbox}
                        >
                            {t("pages.email.connect.manage")}
                        </Button>
                    ) : null}
                </div>
            ) : (
                <div className="flex flex-col gap-1">
                    {onManageMailbox ? (
                        <div className="mb-1 flex justify-end">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={onManageMailbox}
                            >
                                {t("pages.email.connect.manage")}
                            </Button>
                        </div>
                    ) : null}
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
                            <p className="m-0 text-sm text-dr-text">
                                {selectedConnection.from_email}
                            </p>
                        </ModalField>
                    )}

                    {selectedConnection.reply_to_email ? (
                        <ModalField label={t("pages.email.composer.reply_to")}>
                            <p className="m-0 text-sm text-dr-text">
                                {selectedConnection.reply_to_email}
                            </p>
                        </ModalField>
                    ) : null}

                    <AddressChips
                        label={t("pages.email.composer.to")}
                        selected={form.to}
                        options={(allowedAddresses ?? []).map(
                            (item) => item.address,
                        )}
                        disabled={sending}
                        addLabel={t("pages.email.composer.add_recipient")}
                        removeLabel={t("pages.email.composer.remove_recipient")}
                        onChange={(to) => updateForm({ to })}
                    />

                    <AddressChips
                        label={t("pages.email.composer.cc")}
                        selected={form.cc}
                        options={(allowedAddresses ?? []).map(
                            (item) => item.address,
                        )}
                        disabled={sending}
                        addLabel={t("pages.email.composer.add_recipient")}
                        removeLabel={t("pages.email.composer.remove_recipient")}
                        onChange={(cc) => updateForm({ cc })}
                    />

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
                        <div
                            className="m-0 text-sm text-dr-text-muted"
                            role="status"
                        >
                            <p className="m-0">{statusLabel}</p>
                            {lastAttempt.status === "sent" ? (
                                <p className="mb-0 mt-1">
                                    {t("pages.email.composer.not_delivered")}
                                </p>
                            ) : null}
                            {lastAttempt.status === "waiting_quota" ? (
                                <p className="mb-0 mt-1">
                                    {t(
                                        "pages.email.connect.waiting_to_send_hint",
                                    )}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            )}
        </>
    );

    if (variant === "embedded") {
        if (!open) return null;
        return (
            <div className="flex flex-col gap-3 border-t border-dr-border pt-4">
                {form}
                <div className="flex justify-end gap-2">{actions}</div>
            </div>
        );
    }

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
            footer={actions}
        >
            {form}
        </Modal>
    );
}

function AddressChips({
    label,
    selected,
    options,
    disabled,
    addLabel,
    removeLabel,
    onChange,
}: {
    label: string;
    selected: string[];
    options: string[];
    disabled: boolean;
    addLabel: string;
    removeLabel: string;
    onChange: (next: string[]) => void;
}) {
    const remaining = options.filter(
        (address) =>
            !selected.some(
                (chosen) => chosen.toLowerCase() === address.toLowerCase(),
            ),
    );

    return (
        <ModalField label={label}>
            <div className="flex flex-wrap items-center gap-2">
                {selected.map((address) => (
                    <span
                        key={address}
                        className="inline-flex items-center gap-1 rounded-full border border-dr-border bg-dr-surface-2 px-2 py-1 text-sm text-dr-text"
                    >
                        {address}
                        <button
                            type="button"
                            className="border-0 bg-transparent p-0 text-dr-text-muted"
                            disabled={disabled}
                            aria-label={removeLabel}
                            onClick={() =>
                                onChange(
                                    selected.filter(
                                        (chosen) =>
                                            chosen.toLowerCase() !==
                                            address.toLowerCase(),
                                    ),
                                )
                            }
                        >
                            ×
                        </button>
                    </span>
                ))}
                {remaining.length > 0 ? (
                    <select
                        className="dr-input"
                        value=""
                        disabled={disabled}
                        aria-label={addLabel}
                        onChange={(event) => {
                            const value = event.target.value;
                            if (!value) return;
                            onChange([...selected, value]);
                        }}
                    >
                        <option value="">{addLabel}</option>
                        {remaining.map((address) => (
                            <option key={address} value={address}>
                                {address}
                            </option>
                        ))}
                    </select>
                ) : null}
            </div>
        </ModalField>
    );
}
