import { useEffect, useState } from "react";
import { Alert, Checkbox, Input, Modal, Radio, Select } from "antd";
import axios from "axios";
import useTranslation from "@/Hooks/useTranslation";
import type {
    SuppressionChannel,
    SuppressionContactTarget,
    SuppressionEntityType,
    SuppressionScope,
} from "./types";

interface BlockSuppressionModalProps {
    open: boolean;
    onClose: () => void;
    entityType: SuppressionEntityType;
    entityId: number;
    targets: SuppressionContactTarget[];
    onBlocked: () => Promise<void> | void;
}

const CHANNELS: SuppressionChannel[] = [
    "email",
    "whatsapp",
    "sms",
    "telegram",
    "instagram",
    "call",
];

const REASON_OPTIONS = [
    "manual",
    "do_not_call",
    "unsubscribed",
    "complained",
];

export default function BlockSuppressionModal({
    open,
    onClose,
    entityType,
    entityId,
    targets,
    onBlocked,
}: BlockSuppressionModalProps) {
    const { t } = useTranslation();
    const [targetMode, setTargetMode] = useState<string>("record");
    const [selectedChannels, setSelectedChannels] = useState<
        SuppressionChannel[]
    >(["email"]);
    const [scope, setScope] = useState<SuppressionScope>("non_transactional");
    const [reason, setReason] = useState<string>("manual");
    const [note, setNote] = useState<string>("");
    const [applyToFutureDetails, setApplyToFutureDetails] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setTargetMode(targets.length > 0 ? targets[0].value : "record");
        setSelectedChannels(["email"]);
        setScope("non_transactional");
        setReason("manual");
        setNote("");
        setApplyToFutureDetails(true);
        setError(null);
    }, [open, targets]);

    const selectedTarget = targets.find((item) => item.value === targetMode);
    const isWholeRecord = targetMode === "record" || !selectedTarget;

    const handleSubmit = async () => {
        if (selectedChannels.length === 0 || !reason.trim()) {
            setError(
                t("pages.suppressions.block_modal.validation_required"),
            );
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const payload: Record<string, unknown> = {
                channels: selectedChannels,
                scope,
                reason: reason.trim(),
                note: note.trim() || undefined,
                entityType,
                entityId,
                applyToFutureDetails: isWholeRecord
                    ? applyToFutureDetails
                    : false,
            };

            if (!isWholeRecord && selectedTarget) {
                if (selectedTarget.type === "email") {
                    payload.email = selectedTarget.value;
                } else {
                    payload.phone = selectedTarget.value;
                }
            }

            await axios.post("/suppressions", payload);
            await onBlocked();
            onClose();
        } catch (err) {
            if (axios.isAxiosError(err)) {
                const msg = (err.response?.data as { message?: string })
                    ?.message;
                setError(
                    msg || t("pages.suppressions.block_modal.error_generic"),
                );
            } else {
                setError(t("pages.suppressions.block_modal.error_generic"));
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            title={t("pages.suppressions.block_modal.title")}
            onCancel={onClose}
            onOk={() => void handleSubmit()}
            okText={t("pages.suppressions.block_modal.submit")}
            cancelText={t("pages.suppressions.common.cancel")}
            confirmLoading={submitting}
            destroyOnClose
        >
            <div className="flex flex-col gap-3 pt-2">
                {error ? <Alert type="error" showIcon message={error} /> : null}

                <div>
                    <label className="mb-1 block text-xs font-medium text-dr-text">
                        {t("pages.suppressions.block_modal.target_label")}
                    </label>
                    <Select
                        className="w-full"
                        value={targetMode}
                        onChange={(val) => setTargetMode(val)}
                        options={[
                            ...targets.map((item) => ({
                                value: item.value,
                                label: `${item.label}: ${item.value}`,
                            })),
                            {
                                value: "record",
                                label: t(
                                    "pages.suppressions.block_modal.whole_record",
                                ),
                            },
                        ]}
                    />
                </div>

                {isWholeRecord ? (
                    <Checkbox
                        checked={applyToFutureDetails}
                        onChange={(e) =>
                            setApplyToFutureDetails(e.target.checked)
                        }
                    >
                        {t(
                            "pages.suppressions.block_modal.apply_to_future_details",
                        )}
                    </Checkbox>
                ) : null}

                <div>
                    <label className="mb-1 block text-xs font-medium text-dr-text">
                        {t("pages.suppressions.block_modal.channels_label")}
                    </label>
                    <Checkbox.Group
                        className="grid grid-cols-3 gap-2"
                        value={selectedChannels}
                        onChange={(vals) =>
                            setSelectedChannels(vals as SuppressionChannel[])
                        }
                        options={CHANNELS.map((ch) => ({
                            value: ch,
                            label: t(`pages.suppressions.channels.${ch}`),
                        }))}
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-medium text-dr-text">
                        {t("pages.suppressions.block_modal.scope_label")}
                    </label>
                    <Radio.Group
                        value={scope}
                        onChange={(e) =>
                            setScope(e.target.value as SuppressionScope)
                        }
                        className="flex flex-col gap-1"
                    >
                        <Radio value="non_transactional">
                            {t("pages.suppressions.scopes.non_transactional")}
                        </Radio>
                        <Radio value="transactional">
                            {t("pages.suppressions.scopes.transactional")}
                        </Radio>
                        <Radio value="all">
                            {t("pages.suppressions.scopes.all")}
                        </Radio>
                    </Radio.Group>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-medium text-dr-text">
                        {t("pages.suppressions.block_modal.reason_label")}
                    </label>
                    <Select
                        className="w-full"
                        value={reason}
                        onChange={(val) => setReason(val)}
                        options={REASON_OPTIONS.map((opt) => ({
                            value: opt,
                            label: t(`pages.suppressions.reasons.${opt}`),
                        }))}
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-medium text-dr-text">
                        {t("pages.suppressions.block_modal.note_label")}
                    </label>
                    <Input.TextArea
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t(
                            "pages.suppressions.block_modal.note_placeholder",
                        )}
                    />
                </div>
            </div>
        </Modal>
    );
}
