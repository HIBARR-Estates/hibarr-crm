import { useEffect, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type {
    CrmEventDirection,
    CrmEventStatus,
} from "@/Types/api/crm-event";
import type { TimelineEventViewModel } from "../../adapters/timelineAdapter";
import type { TimelineEventUpdateInput } from "../../hooks/useDealTimelineEventMutations";
import DealButton from "../primitives/DealButton";
import { DealModal, DealModalField } from "../primitives/DealModal";

dayjs.extend(utc);

const STATUS_OPTIONS: Array<{ value: CrmEventStatus; labelKey: string }> = [
    { value: "completed", labelKey: "status_completed" },
    { value: "error_occurred", labelKey: "status_error" },
    { value: "missed", labelKey: "status_missed" },
    { value: "rejected", labelKey: "status_rejected" },
];

const DIRECTION_OPTIONS: Array<{
    value: CrmEventDirection;
    labelKey: string;
}> = [
    { value: "inbound", labelKey: "direction_inbound" },
    { value: "outbound", labelKey: "direction_outbound" },
];

interface DealTimelineEventEditModalProps {
    event: TimelineEventViewModel | null;
    open: boolean;
    saving: boolean;
    onClose: () => void;
    onSubmit: (input: TimelineEventUpdateInput) => void;
}

export default function DealTimelineEventEditModal({
    event,
    open,
    saving,
    onClose,
    onSubmit,
}: DealTimelineEventEditModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [status, setStatus] = useState<CrmEventStatus>("completed");
    const [direction, setDirection] = useState<CrmEventDirection | "">("");
    const [occurredAt, setOccurredAt] = useState("");
    const [comment, setComment] = useState("");

    // Rehydrate the form each time a new event is opened for editing.
    useEffect(() => {
        if (!event) return;
        setStatus(event.status);
        setDirection(event.direction ?? "");
        setOccurredAt(
            event.occurredAt
                ? dayjs(event.occurredAt).format("YYYY-MM-DDTHH:mm")
                : "",
        );
        setComment(event.comment ?? "");
    }, [event]);

    const handleSubmit = () => {
        if (!event) return;
        onSubmit({
            status,
            // Empty selection explicitly clears the direction.
            direction: direction === "" ? null : direction,
            comment,
            occurred_at: occurredAt
                ? dayjs(occurredAt).utc().toISOString()
                : undefined,
        });
    };

    return (
        <DealModal
            open={open}
            title={t("pages.deals.timeline.edit_event")}
            onClose={onClose}
            footer={
                <>
                    <DealButton
                        variant="ghost"
                        onClick={onClose}
                        disabled={saving}
                    >
                        {t("pages.deals.common.cancel")}
                    </DealButton>
                    <DealButton
                        variant="primary"
                        onClick={handleSubmit}
                        loading={saving}
                        disabled={saving}
                    >
                        {t("pages.deals.common.save_changes")}
                    </DealButton>
                </>
            }
        >
            {event && (
                <div className="mb-3 text-[13px] font-semibold" style={{ color: "#1a1f2e" }}>
                    {td(event.title)}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DealModalField label={t("pages.deals.timeline.status")}>
                    <select
                        value={status}
                        disabled={saving}
                        onChange={(e) =>
                            setStatus(e.target.value as CrmEventStatus)
                        }
                    >
                        {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {t(`pages.deals.timeline.${option.labelKey}`)}
                            </option>
                        ))}
                    </select>
                </DealModalField>

                <DealModalField label={t("pages.deals.timeline.direction")}>
                    <select
                        value={direction}
                        disabled={saving}
                        onChange={(e) =>
                            setDirection(
                                e.target.value as CrmEventDirection | "",
                            )
                        }
                    >
                        <option value="">{t("pages.deals.common.none")}</option>
                        {DIRECTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {t(`pages.deals.timeline.${option.labelKey}`)}
                            </option>
                        ))}
                    </select>
                </DealModalField>
            </div>

            <DealModalField label={t("pages.deals.timeline.date_time")}>
                <input
                    type="datetime-local"
                    value={occurredAt}
                    disabled={saving}
                    onChange={(e) => setOccurredAt(e.target.value)}
                />
            </DealModalField>

            <DealModalField label={t("pages.deals.timeline.message")}>
                <textarea
                    value={comment}
                    disabled={saving}
                    rows={3}
                    maxLength={2000}
                    placeholder={t("pages.deals.timeline.message_placeholder")}
                    style={{ resize: "vertical" }}
                    onChange={(e) => setComment(e.target.value)}
                />
            </DealModalField>
        </DealModal>
    );
}
