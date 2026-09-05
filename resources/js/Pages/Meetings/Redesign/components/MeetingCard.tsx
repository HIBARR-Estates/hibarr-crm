import { router } from "@inertiajs/react";
import {
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    LinkOutlined,
} from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import AvatarStack, {
    type AvatarStackPerson,
} from "@/Components/Redesign/primitives/AvatarStack";
import DateBlock from "@/Components/Redesign/primitives/DateBlock";
import Icon from "@/Components/Redesign/primitives/Icon";
import RowActionMenu, {
    type RowAction,
} from "@/Components/Redesign/primitives/RowActionMenu";
import { REDESIGN_RADIUS as R, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import {
    canJoinMeeting,
    hasMeetingPermission,
    meetingDateParts,
    meetingRange,
    meetingRecordLink,
    meetingSummaryState,
    platformIconName,
    platformLabelKey,
    type MeetingBucket,
} from "../adapters/meetingViewModel";

interface MeetingCardProps {
    meeting: DealFollowup;
    bucket: MeetingBucket;
    permissions: Record<string, string>;
    userId?: number;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export default function MeetingCard({
    meeting,
    bucket,
    permissions,
    userId,
    onView,
    onEdit,
    onDelete,
}: MeetingCardProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { timezone, formatTime } = useUserDateTime();

    const live = bucket === "live";
    const past = bucket === "past";
    const { month, day, weekday } = meetingDateParts(
        meeting.next_follow_up_date,
        timezone,
    );
    const { end } = meetingRange(meeting, timezone);
    const record = meetingRecordLink(meeting);
    const summaryState = meetingSummaryState(meeting, bucket);
    const showJoin = canJoinMeeting(meeting, bucket);

    const labelKey = platformLabelKey(meeting.location);
    // A free-text place is stored in `location` itself, so there's no lang key
    // to resolve — translate the stored string on the fly instead.
    const platformLabel = labelKey ? t(labelKey) : td(meeting.location);

    const timeRange = `${formatTime(meeting.next_follow_up_date)} – ${formatTime(end)}`;
    const timeMeta = live ? `${td("Now")} · ${timeRange}` : timeRange;

    const participants: AvatarStackPerson[] = (
        meeting.participant_users ?? []
    ).map((person) => ({
        id: person.id,
        name: person.name,
        // image_url is always set (gravatar placeholder), so key off the raw
        // `image` column to decide between a photo and initials.
        image: person.image ? (person.image_url ?? null) : null,
        type:
            person.id === (meeting.host_id ?? meeting.added_by?.id)
                ? ("agent" as const)
                : ("participant" as const),
    }));

    const actions: RowAction[] = [];
    if (hasMeetingPermission(permissions.view_lead_follow_up, meeting, userId)) {
        actions.push({
            key: "view",
            label: t("pages.meetings.card.actions.view"),
            icon: <EyeOutlined />,
            onSelect: onView,
        });
    }
    if (hasMeetingPermission(permissions.edit_lead_follow_up, meeting, userId)) {
        actions.push({
            key: "edit",
            label: t("pages.meetings.card.actions.edit"),
            icon: <EditOutlined />,
            onSelect: onEdit,
        });
    }
    if (showJoin) {
        actions.push({
            key: "join",
            label: t("pages.meetings.card.actions.join_meeting"),
            icon: <LinkOutlined />,
            onSelect: () =>
                window.open(
                    meeting.meeting_link,
                    "_blank",
                    "noopener,noreferrer",
                ),
        });
    }
    if (
        hasMeetingPermission(permissions.delete_lead_follow_up, meeting, userId)
    ) {
        actions.push({
            key: "delete",
            label: t("pages.meetings.card.actions.delete"),
            icon: <DeleteOutlined />,
            danger: true,
            onSelect: onDelete,
        });
    }

    return (
        <div
            className="dr-meeting-card cursor-pointer p-4"
            onClick={onView}
            style={{
                background: T.WHITE,
                border: `1px solid ${live ? T.RED_MID : T.BORDER}`,
                borderRadius: 10,
            }}
        >
            <div className="flex items-start gap-3">
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
                            <Icon
                                name={platformIconName(meeting.location)}
                                size={15}
                            />
                        </span>
                        <span
                            className="truncate font-semibold"
                            style={{ fontSize: 15, color: T.TEXT }}
                        >
                            {meeting.meeting_type?.name
                                ? td(meeting.meeting_type.name)
                                : platformLabel}
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
                        <button
                            type="button"
                            className="dr-meeting-record mt-1 block max-w-full truncate text-left font-semibold"
                            style={{ fontSize: 13, color: T.BLUE }}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (record.href) router.visit(record.href);
                            }}
                        >
                            {td(record.name)}
                        </button>
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
                    className="shrink-0"
                    onClick={(event) => event.stopPropagation()}
                >
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
                    {summaryState !== "ready" && showJoin && (
                        <a
                            href={meeting.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dr-meeting-link inline-flex items-center gap-1.5 font-semibold"
                            style={{ fontSize: 12, color: T.BLUE }}
                        >
                            <Icon name="video" size={13} />
                            {t("pages.meetings.card.actions.join_meeting")}
                        </a>
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
