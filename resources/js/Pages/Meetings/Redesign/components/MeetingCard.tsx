import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import AvatarStack from "@/Components/Redesign/primitives/AvatarStack";
import DateBlock from "@/Components/Redesign/primitives/DateBlock";
import Icon from "@/Components/Redesign/primitives/Icon";
import RowActionMenu from "@/Components/Redesign/primitives/RowActionMenu";
import SelectCheckbox from "@/Components/Redesign/primitives/SelectCheckbox";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import useMeetingPresentation from "../hooks/useMeetingPresentation";
import type { MeetingBucket } from "../adapters/meetingViewModel";

interface MeetingCardProps {
    meeting: DealFollowup;
    bucket: MeetingBucket;
    permissions: Record<string, string>;
    userId?: number;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    /** Opens the post-meeting report form. */
    onReport: () => void;
    /**
     * Bulk-select affordance. Off for the "next up" strip, where a card is a
     * shortcut to one meeting rather than a row in a set you act on together.
     */
    selectable?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}

export default function MeetingCard({
    meeting,
    bucket,
    permissions,
    userId,
    onView,
    onEdit,
    onDelete,
    onReport,
    selectable = true,
    selected = false,
    onToggleSelect,
}: MeetingCardProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const {
        live,
        past,
        month,
        day,
        weekday,
        timeMeta,
        title,
        platformLabel,
        platformIcon,
        record,
        summaryState,
        showJoin,
        participants,
        actions,
    } = useMeetingPresentation({
        meeting,
        bucket,
        permissions,
        userId,
        onView,
        onEdit,
        onDelete,
        onReport,
    });

    return (
        <div
            className="dr-meeting-card cursor-pointer p-4"
            onClick={onView}
            style={{
                background: selected ? T.BLUE_LIGHT : T.WHITE,
                border: `1px solid ${selected ? T.BLUE_MID : live ? T.RED_MID : T.BORDER}`,
                borderRadius: 10,
            }}
        >
            <div className="flex items-start gap-3">
                {selectable && (
                    <SelectCheckbox
                        checked={selected}
                        onChange={() => onToggleSelect?.()}
                        label={td("Select meeting")}
                    />
                )}
                <DateBlock
                    monthLabel={month}
                    dayLabel={day}
                    weekdayLabel={weekday}
                    muted={past}
                />

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className="flex shrink-0"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            <Icon name={platformIcon} size={15} />
                        </span>
                        <span
                            className="truncate font-semibold"
                            style={{ fontSize: 15, color: T.TEXT }}
                        >
                            {title}
                        </span>
                        {live && (
                            <span
                                className="inline-flex shrink-0 animate-pulse items-center gap-1.5 font-semibold"
                                style={{
                                    fontSize: 12,
                                    color: T.RED,
                                    background: T.RED_SOFT,
                                    border: `1px solid ${T.RED_MID}`,
                                    borderRadius: R.FULL,
                                    padding: "2px 9px",
                                }}
                            >
                                <span
                                    className="rounded-full"
                                    style={{
                                        width: 6,
                                        height: 6,
                                        background: T.RED,
                                    }}
                                />
                                {t("pages.meetings.card.live")}
                            </span>
                        )}
                    </div>

                    {record ? (
                        <a
                            href={record.href ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dr-meeting-record mt-1 block max-w-full truncate text-left font-semibold no-underline"
                            style={{ fontSize: 13, color: T.BLUE }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            {td(record.name)}
                        </a>
                    ) : (
                        <div
                            className="mt-1"
                            style={{ fontSize: 13, color: T.TEXT_HINT }}
                        >
                            {t("pages.meetings.card.no_deal")}
                        </div>
                    )}

                    <div
                        className="mt-[3px]"
                        style={{ fontSize: 12, color: T.TEXT_MUTED }}
                    >
                        {timeMeta} · {platformLabel}
                    </div>
                </div>

                <RowActionMenu
                    actions={actions}
                    ariaLabel={td("Meeting actions")}
                />
            </div>

            <div
                className="my-3.5 h-px"
                style={{ background: T.BORDER_SOFT }}
            />

            <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 items-center gap-2">
                    {participants.length > 0 ? (
                        <>
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
                        </>
                    ) : (
                        <span
                            className="inline-flex items-center gap-1"
                            style={{ fontSize: 12, color: T.TEXT_HINT }}
                        >
                            <Icon name="user" size={13} />
                            {t("pages.meetings.card.no_participants")}
                        </span>
                    )}
                </div>

                <div
                    className="flex shrink-0 items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                >
                    {/* Open the record, and join the call. Both leave the
                        meetings list where it is — you come back to it after
                        the meeting, so it should still be there. */}
                    {/* Live and joinable: attending is the action; the record
                        is still one click away via its name above. */}
                    {record?.href && !(live && showJoin) && (
                        <a
                            href={record.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dr-btn dr-btn-ghost no-underline"
                            style={{ fontSize: 12, padding: "5px 10px" }}
                        >
                            <Icon name="external-link" size={13} />
                            {record.type === "lead"
                                ? td("Open lead")
                                : td("Open deal")}
                        </a>
                    )}
                    {showJoin && (
                        <a
                            href={meeting.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dr-btn dr-btn-primary no-underline"
                            style={{ fontSize: 12, padding: "5px 10px" }}
                        >
                            <Icon name="video" size={13} />
                            {t("pages.meetings.card.actions.join_meeting")}
                        </a>
                    )}
                    {summaryState === "ready" && (
                        <button
                            type="button"
                            className="dr-meeting-link inline-flex items-center gap-1.5 font-semibold"
                            style={{ fontSize: 12, color: T.GREEN }}
                            onClick={onView}
                        >
                            <Icon name="file-text" size={13} />
                            {t("pages.meetings.card.view_summary")}
                        </button>
                    )}
                    {summaryState === "generating" && (
                        <span
                            className="font-semibold"
                            style={{
                                fontSize: 12,
                                color: T.AMBER,
                                background: T.AMBER_BANNER,
                                border: `1px solid ${T.AMBER_MID}`,
                                borderRadius: R.FULL,
                                padding: "3px 10px",
                            }}
                        >
                            {t("pages.meetings.card.generating_summary")}
                        </span>
                    )}
                </div>
            </div>

            {meeting.added_by && (
                <div
                    className="mt-2.5 truncate"
                    style={{ fontSize: 12, color: T.TEXT_HINT }}
                >
                    {t("pages.meetings.card.added_by")} {meeting.added_by.name}
                </div>
            )}
        </div>
    );
}
