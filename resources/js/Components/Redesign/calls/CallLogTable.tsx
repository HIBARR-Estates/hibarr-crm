import { Fragment, useState, type CSSProperties } from "react";
import RecordingPlayer from "@/Components/CallRecordingPlayer";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { formatCallDuration } from "@/lib/crmEvents/callSummary";
import { CallDirectionIcon, OUTCOME_KEYS, formatCallFailure, getRecordingStatus } from "./callFormat";
import type { CallLogRow } from "./types";

const COLUMN_COUNT = 6;

const headCell: CSSProperties = {
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: T.TEXT_MUTED,
    textAlign: "left",
    whiteSpace: "nowrap",
    borderBottom: `1px solid ${T.BORDER_SOFT}`,
};

const bodyCell: CSSProperties = {
    padding: "12px",
    verticalAlign: "middle",
    fontSize: 14,
    color: T.TEXT,
};

const subText: CSSProperties = {
    display: "block",
    fontSize: 12,
    color: T.TEXT_MUTED,
    marginTop: 2,
};

/**
 * The company call log as a table: When · Call · Lead or deal · Agent ·
 * Duration · Recording. Playing a recording opens the player in a full-width
 * row under the call. Scrolls sideways inside its box on narrow screens.
 */
export default function CallLogTable({ rows }: { rows: CallLogRow[] }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { formatDateTime } = useUserDateTime();
    const [openId, setOpenId] = useState<number | null>(null);

    return (
        <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse" }}>
                <thead>
                    <tr style={{ background: T.SURFACE_2 }}>
                        <th scope="col" style={{ ...headCell, paddingLeft: 18 }}>{t("pages.calls.col_when")}</th>
                        <th scope="col" style={headCell}>{t("pages.calls.col_call")}</th>
                        <th scope="col" style={headCell}>{t("pages.calls.col_entity")}</th>
                        <th scope="col" style={headCell}>{t("pages.calls.agent")}</th>
                        <th scope="col" style={headCell}>{t("pages.calls.col_duration")}</th>
                        <th scope="col" style={{ ...headCell, paddingRight: 18 }}>{t("pages.calls.col_recording")}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const direction =
                            row.direction === "inbound"
                                ? t("pages.calls.filter_inbound")
                                : row.direction === "outbound"
                                  ? t("pages.calls.filter_outbound")
                                  : t("pages.call_summary.call");
                        const outcomeKey = OUTCOME_KEYS[row.outcome];
                        const outcome = outcomeKey
                            ? t(`pages.call_summary.${outcomeKey}`)
                            : td(row.outcome, { source: "en" });
                        const missed = row.outcome === "missed" || row.outcome === "failed";
                        const failureText = formatCallFailure(row.failure_reason, row.failure_message, t);
                        const rec = row.recording;
                        const recState = getRecordingStatus(row);
                        const playable = Boolean(rec?.can_play && rec.play_url);
                        const open = openId === row.id && playable;
                        const rowBg = open ? T.BLUE_LIGHT : T.SURFACE;

                        return (
                            <Fragment key={row.id}>
                                <tr style={{ background: rowBg, borderTop: `1px solid ${T.BORDER_SOFT}` }}>
                                    <td style={{ ...bodyCell, paddingLeft: 18, whiteSpace: "nowrap" }}>
                                        {formatDateTime(row.occurred_at)}
                                    </td>
                                    <td style={bodyCell}>
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                            <CallDirectionIcon direction={row.direction} outcome={row.outcome} size={28} />
                                            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                    <span style={{ fontWeight: 600, color: missed ? T.RED : T.TEXT }}>
                                                        {direction} · {outcome}
                                                    </span>
                                                    {failureText && (
                                                        <Badge variant="red" style={{ fontSize: 11, padding: "1px 8px" }}>
                                                            {failureText}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {row.phone_number && (
                                                    <span style={subText}>{row.phone_number}</span>
                                                )}
                                                {row.is_forwarded && row.forwarded_from_user_name && (
                                                    <span style={{ ...subText, color: T.TEAL, fontWeight: 500 }}>
                                                        {t("pages.calls.forwarded_from", { user: row.forwarded_from_user_name })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={bodyCell}>
                                        {row.entity_url ? (
                                            <>
                                                <a
                                                    href={row.entity_url}
                                                    style={{ fontWeight: 600, color: T.BLUE, textDecoration: "none" }}
                                                >
                                                    {row.entity_name || t("pages.calls.unnamed_record")}
                                                </a>
                                                <span style={subText}>
                                                    {row.entity_type === "deal"
                                                        ? t("pages.calls.entity_deal")
                                                        : t("pages.calls.entity_lead")}
                                                </span>
                                            </>
                                        ) : (
                                            <Badge variant="amber">{t("pages.calls.no_lead_matched")}</Badge>
                                        )}
                                    </td>
                                    <td style={bodyCell}>{row.user_name ?? "—"}</td>
                                    <td style={{ ...bodyCell, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                        {row.duration ? (
                                            formatCallDuration(row.duration, t)
                                        ) : (
                                            <span style={{ color: T.TEXT_HINT }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ ...bodyCell, paddingRight: 18, whiteSpace: "nowrap" }}>
                                        {recState.status === "playable" && playable ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                aria-expanded={open}
                                                icon={
                                                    open ? (
                                                        <Icon name="chevron-up" size={14} />
                                                    ) : (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                            <path d="M8 5v14l11-7z" />
                                                        </svg>
                                                    )
                                                }
                                                onClick={() => setOpenId(open ? null : row.id)}
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
                                                title={recState.expiresAt ? `Expired: ${recState.expiresAt}` : undefined}
                                            >
                                                {t("pages.calls.recording_expired_short")}
                                            </Badge>
                                        ) : recState.status === "restricted" ? (
                                            <span
                                                title={t("pages.calls.recording_restricted")}
                                                style={{ fontSize: 12, color: T.TEXT_MUTED, display: "inline-flex", alignItems: "center", gap: 6 }}
                                            >
                                                <Icon name="lock" size={13} />
                                                {t("pages.calls.recording_locked")}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: 12, color: T.TEXT_HINT }}>{t("pages.calls.no_recording")}</span>
                                        )}
                                    </td>
                                </tr>
                                {open && rec?.play_url && (
                                    <tr style={{ background: rowBg }}>
                                        <td colSpan={COLUMN_COUNT} style={{ padding: "0 18px 14px" }}>
                                            <RecordingPlayer
                                                playUrl={rec.play_url}
                                                downloadUrl={rec.download_url}
                                                durationSeconds={rec.duration_seconds}
                                                filename={rec.filename ?? undefined}
                                                expired={rec.expired}
                                            />
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
