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
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import { formatMeetingTimeRange } from "../adapters/meetingTimeLabel";
import {
    canJoinMeeting,
    hasMeetingPermission,
    meetingDateParts,
    meetingRange,
    meetingRecordLink,
    meetingSummaryState,
    platformChipColor,
    platformIconName,
    platformLabelKey,
    startsInLabel,
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

/** The one badge a row shows for "what happened to this meeting". */
export interface MeetingStateChip {
    label: string;
    bg: string;
    border: string;
    color: string;
    /** Live is the only state worth animating. */
    pulse?: boolean;
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
    platformChipColor: string;
    record: MeetingRecordLink | null;
    /** The deal's pipeline stage, when the record is a deal on a pipeline. */
    stage: { name: string; color?: string | null } | null;
    summaryState: MeetingSummaryState;
    showJoin: boolean;
    participants: AvatarStackPerson[];
    /** First names, for a list that has room for words rather than initials. */
    participantNames: string;
    /** Scheduled / Cancelled / Completed / No-show / Live — the table's status column. */
    stateChip: MeetingStateChip | null;
    /** Countdown under the "Scheduled" chip, e.g. "Starts in 2h". Empty otherwise. */
    stateSubtext: string;
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
    const { timezone } = useUserDateTime();

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

    const dealStage = meeting.deal && "leadStage" in meeting.deal
        ? meeting.deal.leadStage
        : null;
    const stage = dealStage?.name
        ? { name: dealStage.name, color: dealStage.label_color }
        : null;

    const labelKey = platformLabelKey(meeting.location);
    // A free-text place is stored in `location` itself, so there's no lang key
    // to resolve — translate the stored string on the fly instead.
    const platformLabel = labelKey ? t(labelKey) : td(meeting.location);

    const timeRange = formatMeetingTimeRange(meeting.next_follow_up_date, end);
    const minutesRemaining = Math.max(0, end.diff(dayjs(), "minute"));

    const hostId = meeting.host_id ?? meeting.added_by?.id;
    const participants: AvatarStackPerson[] = (
        meeting.participant_users ?? []
    ).map((person) => ({
        id: person.id,
        name: person.name,
        // image_url is always set (gravatar placeholder), so key off the raw
        // `image` column to decide between a photo and initials.
        image: person.image ? (person.image_url ?? null) : null,
        // Uniformly "participant" for the fill — every other people group in
        // the redesign renders one (the deal header's participants, the team
        // modal), and a second color palette just for this page would read as
        // its own thing. The ring (isHost) is enough to single them out.
        type: "participant" as const,
        isHost: person.id === hostId,
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

    // A badge only where there is news. "Scheduled" on every future row is
    // noise; cancelled, held, or a no-show client is what someone scanning
    // the list is actually looking for.
    let stateChip: MeetingStateChip | null = null;
    let stateSubtext = "";
    if (live) {
        stateChip = {
            label: t("pages.meetings.card.live"),
            bg: T.RED_SOFT,
            border: T.RED_MID,
            color: T.RED,
            pulse: true,
        };
    } else if (meeting.status === "cancelled" || meeting.status === "canceled") {
        stateChip = {
            label: td("Cancelled"),
            bg: T.SURFACE_2,
            border: T.BORDER,
            color: T.TEXT_MUTED,
        };
    } else if (meeting.client_attended === false) {
        stateChip = {
            label: td("No show"),
            bg: T.AMBER_BANNER,
            border: T.AMBER_MID,
            color: T.AMBER,
        };
    } else if (meeting.status === "completed") {
        stateChip = {
            label: td("Held"),
            bg: T.GREEN_LIGHT,
            border: T.GREEN_MID,
            color: T.GREEN,
        };
    } else if (past) {
        stateChip = {
            label: td("Not reported"),
            bg: T.SURFACE_2,
            border: T.BORDER,
            color: T.TEXT_HINT,
        };
    } else {
        // Upcoming and nothing has happened to it yet — the table view names
        // this state explicitly rather than leaving the column blank, and
        // pairs it with a countdown so the row says how soon it matters.
        stateChip = {
            label: td("Scheduled"),
            bg: T.BLUE_LIGHT,
            border: T.BLUE_MID,
            color: T.BLUE,
        };
        stateSubtext = startsInLabel(meeting.next_follow_up_date, timezone);
    }

    const firstNames = (meeting.participant_users ?? []).map(
        (person) => (person.name || "").split(" ")[0],
    );

    return {
        live,
        past,
        stateChip,
        stateSubtext,
        participantNames:
            firstNames.length === 0
                ? ""
                : firstNames.length <= 2
                  ? firstNames.join(", ")
                  : `${firstNames.slice(0, 2).join(", ")} +${firstNames.length - 2}`,
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
        platformChipColor: platformChipColor(meeting.location),
        record,
        stage,
        summaryState,
        showJoin,
        participants,
        actions,
    };
}
