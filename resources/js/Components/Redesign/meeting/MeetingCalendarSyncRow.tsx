import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useCalendarSync, {
    CALENDAR_SYNC_FLAG,
    canManageCalendarSync,
} from "@/Hooks/useCalendarSync";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";

interface MeetingCalendarSyncRowProps {
    meeting: DealFollowup;
    /** Defaults to the signed-in user. */
    userId?: number;
    className?: string;
}

/**
 * Zoho Calendar sync state for a meeting — syncing / synced / failed with
 * OL's reason and a retry. Only the creator or host sees it (the only people
 * the sync endpoints answer), and only once a sync has been attempted.
 */
export default function MeetingCalendarSyncRow({
    meeting,
    userId,
    className,
}: MeetingCalendarSyncRowProps) {
    const { td } = useTd();
    const { props } = usePage();
    const viewerId = userId ?? (props.auth?.user?.id as number | undefined);
    const visible =
        props.featureFlags?.[CALENDAR_SYNC_FLAG] === true &&
        canManageCalendarSync(meeting, viewerId) &&
        Boolean(
            meeting.zoho_calendar_job_id || meeting.zoho_calendar_sync_status,
        );

    const { status, error, retry, retrying, hasMaxAttempts, refresh } =
        useCalendarSync(meeting, visible);

    if (!visible || !status) return null;

    const pill =
        status === "synced"
            ? { className: "dr-pill dr-pill-green", label: "Synced" }
            : status === "failed"
              ? { className: "dr-pill", label: "Sync failed" }
              : {
                    className: "dr-pill dr-pill-gray",
                    label: hasMaxAttempts ? "Sync pending" : "Syncing…",
                };

    return (
        <div
            className={`flex items-start gap-3 py-2.5 ${className ?? ""}`}
            style={{ borderBottom: `1px solid ${T.BORDER_SOFT}` }}
        >
            <span
                aria-hidden="true"
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center"
                style={{ background: T.SURFACE_2, borderRadius: R.MD }}
            >
                <Icon name="calendar" size={15} color={T.TEXT_MUTED} />
            </span>
            <span className="min-w-0 flex-1">
                <span
                    className="flex flex-wrap items-center gap-2 font-semibold"
                    style={{ fontSize: 13.5, color: T.TEXT }}
                >
                    {td("Zoho Calendar", { source: "en" })}
                    <span
                        className={pill.className}
                        style={
                            status === "failed"
                                ? {
                                      background: T.RED_SOFT,
                                      color: T.RED,
                                      border: `1px solid ${T.RED_MID}`,
                                  }
                                : undefined
                        }
                    >
                        {td(pill.label, { source: "en" })}
                    </span>
                </span>
                {status === "failed" && error && (
                    <span
                        className="mt-1 block"
                        style={{ fontSize: 12, color: T.RED }}
                    >
                        {td(error, { source: "en" })}
                    </span>
                )}
                {status === "pending" && (
                    <span
                        className="mt-px block"
                        style={{ fontSize: 12, color: T.TEXT_MUTED }}
                    >
                        {hasMaxAttempts
                            ? td("Still waiting on the calendar service.", {
                                  source: "en",
                              })
                            : td("Adding this meeting to the calendar…", {
                                  source: "en",
                              })}
                    </span>
                )}
            </span>
            {status === "failed" && (
                <span className="shrink-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        loading={retrying}
                        disabled={retrying}
                        onClick={() => void retry()}
                    >
                        {td("Retry sync", { source: "en" })}
                    </Button>
                </span>
            )}
            {status === "pending" && hasMaxAttempts && (
                <span className="shrink-0">
                    <Button variant="ghost" size="sm" onClick={refresh}>
                        {td("Refresh", { source: "en" })}
                    </Button>
                </span>
            )}
        </div>
    );
}
