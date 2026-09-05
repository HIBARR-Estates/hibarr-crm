import { router } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import AvatarStack from "@/Components/Redesign/primitives/AvatarStack";
import Icon from "@/Components/Redesign/primitives/Icon";
import RowActionMenu from "@/Components/Redesign/primitives/RowActionMenu";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import useMeetingPresentation from "../hooks/useMeetingPresentation";

interface MeetingLiveCardProps {
    meeting: DealFollowup;
    permissions: Record<string, string>;
    userId?: number;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onReport: () => void;
}

/**
 * A meeting that is happening right now, as a full-width banner above the
 * list.
 *
 * It is deliberately a different object from the card and the row rather
 * than a tinted variant of either: while a meeting is running the only thing
 * that matters is joining it, so the card gives that its own button at a size
 * no grid cell has room for, and spans the width so it cannot be scrolled
 * past. This is what replaced the "Live" filter tab — you don't go looking
 * for a live meeting, it comes to the top of whatever you were looking at.
 */
export default function MeetingLiveCard({
    meeting,
    permissions,
    userId,
    onView,
    onEdit,
    onDelete,
    onReport,
}: MeetingLiveCardProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const {
        timeRange,
        minutesRemaining,
        title,
        platformLabel,
        platformIcon,
        record,
        showJoin,
        participants,
        actions,
    } = useMeetingPresentation({
        meeting,
        bucket: "live",
        permissions,
        userId,
        onView,
        onEdit,
        onDelete,
        onReport,
    });

    return (
        <div
            className="dr-meeting-live flex cursor-pointer flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4"
            onClick={onView}
            style={{
                background: T.RED_SOFT,
                border: `1px solid ${T.RED_MID}`,
                borderRadius: 12,
                // Solid rail rather than a heavier border: at full width a
                // thick red outline reads as an error banner.
                boxShadow: `inset 4px 0 0 0 ${T.RED}`,
            }}
        >
            <span
                className="inline-flex shrink-0 items-center gap-2 font-bold uppercase"
                style={{
                    fontSize: 12,
                    letterSpacing: "0.08em",
                    color: T.WHITE,
                    background: T.RED,
                    borderRadius: R.FULL,
                    padding: "5px 13px",
                }}
            >
                <span
                    className="animate-pulse rounded-full"
                    style={{ width: 7, height: 7, background: T.WHITE }}
                />
                {t("pages.meetings.card.live")}
            </span>

            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="flex shrink-0"
                        style={{ color: T.RED }}
                    >
                        <Icon name={platformIcon} size={16} />
                    </span>
                    <span
                        className="truncate font-bold"
                        style={{ fontSize: 16, color: T.NAVY }}
                    >
                        {title}
                    </span>
                    {record && (
                        <>
                            <span
                                style={{ color: T.TEXT_HINT }}
                                aria-hidden="true"
                            >
                                ·
                            </span>
                            <button
                                type="button"
                                className="dr-meeting-record min-w-0 truncate text-left font-semibold"
                                style={{ fontSize: 14, color: T.BLUE }}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (record.href) router.visit(record.href);
                                }}
                            >
                                {td(record.name)}
                            </button>
                        </>
                    )}
                </div>

                <div
                    className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"
                    style={{ fontSize: 13, color: T.TEXT_MUTED }}
                >
                    <span
                        className="inline-flex items-center gap-1.5 font-semibold"
                        style={{ color: T.RED }}
                    >
                        <Icon name="clock" size={13} />
                        {minutesRemaining > 0
                            ? `${minutesRemaining} ${td("min left")}`
                            : td("Ending now")}
                    </span>
                    <span style={{ color: T.TEXT_HINT }}>·</span>
                    <span>{timeRange}</span>
                    <span style={{ color: T.TEXT_HINT }}>·</span>
                    <span>{platformLabel}</span>
                </div>
            </div>

            {participants.length > 0 && (
                <div className="flex shrink-0 items-center gap-2">
                    <AvatarStack people={participants} />
                    <span
                        className="whitespace-nowrap"
                        style={{ fontSize: 12, color: T.TEXT_MUTED }}
                    >
                        {participants.length}{" "}
                        {participants.length === 1
                            ? t("pages.meetings.card.participant")
                            : t("pages.meetings.card.participants")}
                    </span>
                </div>
            )}

            <div
                className="flex shrink-0 items-center gap-2"
                onClick={(event) => event.stopPropagation()}
            >
                {showJoin && (
                    <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 font-semibold no-underline"
                        style={{
                            background: T.RED,
                            color: T.WHITE,
                            border: `1px solid ${T.RED}`,
                            borderRadius: 8,
                            padding: "9px 16px",
                            fontSize: 14,
                        }}
                    >
                        <Icon name="video" size={15} />
                        {t("pages.meetings.card.actions.join_meeting")}
                    </a>
                )}
                <RowActionMenu
                    actions={actions}
                    ariaLabel={td("Meeting actions")}
                />
            </div>
        </div>
    );
}
