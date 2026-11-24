import { useEffect, useState } from "react";
import { Alert, Input, Modal } from "antd";
import axios from "axios";
import useTranslation from "@/Hooks/useTranslation";
import { isRecipientOptOut } from "./suppressionPolicy";
import type { SuppressionEntityType, SuppressionRestriction } from "./types";

interface LiftSuppressionModalProps {
    open: boolean;
    entry: SuppressionRestriction | null;
    entityType: SuppressionEntityType;
    entityId: number;
    onClose: () => void;
    onLifted: () => Promise<void> | void;
}

export default function LiftSuppressionModal({
    open,
    entry,
    entityType,
    entityId,
    onClose,
    onLifted,
}: LiftSuppressionModalProps) {
    const { t } = useTranslation();
    const [reason, setReason] = useState("");
    const [consentEvidenceText, setConsentEvidenceText] = useState("");
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requiresConsentEvidence = entry ? isRecipientOptOut(entry) : false;

    useEffect(() => {
        if (!open) return;
        setReason("");
        setConsentEvidenceText("");
        setNote("");
        setError(null);
    }, [open, entry?.uuid]);

    const handleSubmit = async () => {
        if (!entry) return;

        if (!reason.trim()) {
            setError(t("pages.suppressions.lift_modal.reason_required"));
            return;
        }

        if (requiresConsentEvidence && !consentEvidenceText.trim()) {
            setError(
                t("pages.suppressions.lift_modal.consent_evidence_required"),
            );
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const payload: Record<string, unknown> = {
                reason: reason.trim(),
                entityType,
                entityId,
                entryChannel: entry.channel,
                entryReason: entry.reason,
                entrySource: entry.source,
            };

            if (note.trim()) {
                payload.note = note.trim();
            }

            if (consentEvidenceText.trim()) {
                payload.consentEvidence = {
                    text: consentEvidenceText.trim(),
                };
            }

            await axios.post(`/suppressions/${entry.uuid}/lift`, payload);
            await onLifted();
            onClose();
        } catch (err) {
            if (axios.isAxiosError(err)) {
                const msg = (err.response?.data as { message?: string })
                    ?.message;
                setError(
                    msg || t("pages.suppressions.lift_modal.error_generic"),
                );
            } else {
                setError(t("pages.suppressions.lift_modal.error_generic"));
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            title={t("pages.suppressions.lift_modal.title")}
            onCancel={onClose}
            onOk={() => void handleSubmit()}
            okText={t("pages.suppressions.lift_modal.submit")}
            cancelText={t("pages.suppressions.common.cancel")}
            confirmLoading={submitting}
            destroyOnClose
        >
            <div className="flex flex-col gap-3 pt-2">
                {error ? <Alert type="error" showIcon message={error} /> : null}

                {entry ? (
                    <div className="rounded border border-dr-border bg-dr-surface-2 p-2.5 text-xs text-dr-text">
                        <div className="font-medium">
                            {t(`pages.suppressions.channels.${entry.channel}`)}{" "}
                            × {t(`pages.suppressions.scopes.${entry.scope}`)}
                        </div>
                        <div className="text-dr-text-muted">
                            {entry.email || entry.phone || ""}
                        </div>
                    </div>
                ) : null}

                <div>
                    <label className="mb-1 block text-xs font-medium text-dr-text">
                        {t("pages.suppressions.lift_modal.reason_label")}
                    </label>
                    <Input.TextArea
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t(
                            "pages.suppressions.lift_modal.reason_placeholder",
                        )}
                    />
                </div>

                {requiresConsentEvidence ? (
                    <div>
                        <label className="mb-1 block text-xs font-medium text-dr-text">
                            {t(
                                "pages.suppressions.lift_modal.consent_evidence_label",
                            )}
                        </label>
                        <Input.TextArea
                            rows={2}
                            value={consentEvidenceText}
                            onChange={(e) =>
                                setConsentEvidenceText(e.target.value)
                            }
                            placeholder={t(
                                "pages.suppressions.lift_modal.consent_evidence_placeholder",
                            )}
                        />
                    </div>
                ) : null}

                <div>
                    <label className="mb-1 block text-xs font-medium text-dr-text">
                        {t("pages.suppressions.lift_modal.note_label")}
                    </label>
                    <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t(
                            "pages.suppressions.lift_modal.note_placeholder",
                        )}
                    />
                </div>
            </div>
        </Modal>
    );
}
