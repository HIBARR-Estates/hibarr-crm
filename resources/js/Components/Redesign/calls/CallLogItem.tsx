import { useState } from "react";
import RecordingPlayer from "@/Components/CallRecordingPlayer";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { formatCallDuration } from "@/lib/crmEvents/callSummary";
import type { CallLogRow } from "./types";
import { CallDirectionIcon, OUTCOME_KEYS, formatCallFailure, getRecordingStatus } from "./callFormat";

interface CallLogItemProps {
    row: CallLogRow;
    /** Show the lead/deal the call belongs to (Calls page). On a lead, only deal calls are tagged. */
    showEntity?: boolean;
    /** Time only (rows grouped under a day heading) or date and time. */
    timeOnly?: boolean;
}

/**
 * One call: direction and outcome, when, duration, agent, the lead or deal it
 * belongs to, and its recording — played inline when the viewer may play it
 * (the server leaves the links out otherwise and says who can).
 */
export default function CallLogItem({ row, showEntity = false, timeOnly = false }: CallLogItemProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { formatTime, formatDateTime } = useUserDateTime();
    const [open, setOpen] = useState(false);

    const direction =
        row.direction === "inbound"
            ? t("pages.call_summary.inbound")
            : row.direction === "outbound"
              ? t("pages.call_summary.outbound")
              : t("pages.call_summary.call");
    const outcomeKey = OUTCOME_KEYS[row.outcome];
    const outcome = outcomeKey ? t(`pages.call_summary.${outcomeKey}`) : td(row.outcome, { source: "en" });
    const when = timeOnly ? formatTime(row.occurred_at) : formatDateTime(row.occurred_at);
    const duration = row.duration ? formatCallDuration(row.duration, t) : "";
    const meta = [when, duration, row.user_name, row.phone_number].filter(Boolean).join(" · ");

    const failureText = formatCallFailure(row.failure_reason, row.failure_message);
    const rec = row.recording;
    const recState = getRecordingStatus(row);
    const playable = Boolean(rec?.can_play && rec.play_url);

    return (
        <div
            style={{
                padding: "14px 18px",
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                background: open ? T.BLUE_WASH : T.SURFACE,
                display: "flex",
                flexDirection: "column",
                gap: 12,
            }}
        >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                <CallDirectionIcon direction={row.direction} outcome={row.outcome} />

                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 280px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: T.TEXT }}>
                            {direction} · {outcome}
                        </span>
                        {failureText && (
                            <Badge variant="red" style={{ fontSize: 11, padding: "1px 8px" }}>
                                {failureText}
                            </Badge>
                        )}
                    </div>
                    <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>{meta}</span>
                </div>

                {showEntity &&
                    (row.entity_url ? (
                        <a
                            href={row.entity_url}
                            style={{ fontSize: 13, fontWeight: 600, color: T.BLUE, textDecoration: "none" }}
                        >
                            {row.entity_name || t("pages.calls.unnamed_record")}
                            <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: T.TEXT_MUTED }}>
                                {row.entity_type === "deal" ? t("pages.calls.entity_deal") : t("pages.calls.entity_lead")}
                            </span>
                        </a>
                    ) : (
                        <Badge variant="amber">{t("pages.calls.no_lead_matched")}</Badge>
                    ))}

                {!showEntity && row.entity_type === "deal" && row.entity_name && (
                    <Badge variant="gray">
                        {t("pages.calls.from_deal", { deal: row.entity_name })}
                    </Badge>
                )}

                {row.is_forwarded && row.forwarded_from_user_name && (
                    <Badge variant="teal">
                        {t("pages.calls.forwarded_from", { user: row.forwarded_from_user_name })}
                    </Badge>
                )}

                {recState.status === "playable" && playable ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={
                            open ? (
                                <Icon name="chevron-up" size={14} />
                            ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )
                        }
                        aria-expanded={open}
                        onClick={() => setOpen((v) => !v)}
                    >
                        {open
                            ? t("pages.calls.hide_recording")
                            : recState.duration
                              ? `${t("pages.calls.play_recording")} (${recState.duration})`
                              : t("pages.calls.play_recording")}
                    </Button>
                ) : recState.status === "processing" ? (
                    <Badge variant="blue" style={{ fontSize: 11, padding: "2px 8px" }}>
                        {t("pages.calls.recording_processing")}
                    </Badge>
                ) : recState.status === "expired" ? (
                    <Badge
                        variant="amber"
                        style={{ fontSize: 11, padding: "2px 8px" }}
                        title={recState.expiresAt ? `${t("pages.calls.recording_expired_short")}: ${formatDateTime(recState.expiresAt)}` : undefined}
                    >
                        {t("pages.calls.recording_expired")}
                    </Badge>
                ) : recState.status === "restricted" ? (
                    <span style={{ fontSize: 12, color: T.TEXT_MUTED, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Icon name="lock" size={13} />
                        {t("pages.calls.recording_restricted")}
                    </span>
                ) : (
                    <span style={{ fontSize: 12, color: T.TEXT_HINT }}>{t("pages.calls.no_recording")}</span>
                )}
            </div>

            {open && playable && rec?.play_url && (
                <RecordingPlayer
                    playUrl={rec.play_url}
                    downloadUrl={rec.download_url}
                    durationSeconds={rec.duration_seconds}
                    filename={rec.filename ?? undefined}
                    expired={rec.expired}
                />
            )}
        </div>
    );
}
