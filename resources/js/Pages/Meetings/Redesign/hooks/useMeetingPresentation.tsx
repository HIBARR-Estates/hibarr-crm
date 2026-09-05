import dayjs from "dayjs";
import {
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    FileTextOutlined,
    LinkOutlined,
} from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import type { AvatarStackPerson } from "@/Components/Redesign/primitives/AvatarStack";
import type { RowAction } from "@/Components/Redesign/primitives/RowActionMenu";
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
    type MeetingRecordLink,
    type MeetingSummaryState,
} from "../adapters/meetingViewModel";

interface UseMeetingPresentationOptions {
    meeting: DealFollowup;
    bucket: MeetingBucket;
    permissions: Record<string, string>;
    userId?: number;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    /** Opens the post-meeting report form. */
    onReport: () => void;
}

export interface MeetingPresentation {
    live: boolean;
    past: boolean;
    /** "AUG" / "14" / "Thu" for the date tile. */
    month: string;
    day: string;
    weekday: string;
    /** "09:00 – 09:30", prefixed with "Now ·" while the meeting is running. */
    timeRange: string;
    timeMeta: string;
    /** Whole minutes left of a running meeting; 0 once it is over. */
    minutesRemaining: number;
    /** Meeting type name when there is one, else the platform's label. */
    title: string;
    platformLabel: string;
    platformIcon: string;
    record: MeetingRecordLink | null;
    summaryState: MeetingSummaryState;
    showJoin: boolean;
    participants: AvatarStackPerson[];
    actions: RowAction[];
}

/**
 * Everything the card and the row both show, derived once.
 *
 * The two layouts differ only in arrangement — same date tile, same title,
 * same record link, same people, same permitted actions — so the derivation
 * lives here rather than being written twice and drifting.
 */
export default function useMeetingPresentation({
    meeting,
    bucket,
    permissions,
    userId,
    onView,
    onEdit,
    onDelete,
    onReport,
}: UseMeetingPresentationOptions): MeetingPresentation {
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
    const minutesRemaining = Math.max(0, end.diff(dayjs(), "minute"));

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
    if (
        hasMeetingPermission(permissions.view_lead_follow_up, meeting, userId)
    ) {
        actions.push({
            key: "view",
            label: t("pages.meetings.card.actions.view"),
            icon: <EyeOutlined />,
            onSelect: onView,
        });
    }
    if (
        hasMeetingPermission(permissions.edit_lead_follow_up, meeting, userId)
    ) {
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
    // Reporting on a meeting only makes sense once it has started; before
    // that there is nothing to report.
    if (
        bucket !== "upcoming" &&
        hasMeetingPermission(permissions.edit_lead_follow_up, meeting, userId)
    ) {
        actions.push({
            key: "report",
            label: t("pages.meetings.card.actions.report"),
            icon: <FileTextOutlined />,
            onSelect: onReport,
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

    return {
        live,
        past,
        month,
        day,
        weekday,
        timeRange,
        timeMeta: live ? `${td("Now")} · ${timeRange}` : timeRange,
        minutesRemaining,
        title: meeting.meeting_type?.name
            ? td(meeting.meeting_type.name)
            : platformLabel,
        platformLabel,
        platformIcon: platformIconName(meeting.location),
        record,
        summaryState,
        showJoin,
        participants,
        actions,
    };
}
