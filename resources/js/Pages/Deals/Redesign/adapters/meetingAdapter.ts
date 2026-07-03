import type { DealFollowup } from "@/Types/api/deal-followup";

export interface WorkspaceMeetingPreview {
    id: number;
    title: string;
    status: string;
    startsAt: Date | null;
    startsAtLabel: string;
    isUpcoming: boolean;
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

function parseDate(value: string | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function toWorkspaceMeetingPreview(meeting: DealFollowup): WorkspaceMeetingPreview {
    const startsAt = parseDate(meeting.next_follow_up_date);
    const normalizedStatus = meeting.status?.trim() || "scheduled";
    const meetingType = meeting.meeting_type?.name?.trim();

    return {
        id: meeting.id,
        title: meetingType || "Meeting",
        status: normalizedStatus,
        startsAt,
        startsAtLabel: startsAt ? DATE_TIME_FORMAT.format(startsAt) : "No date",
        isUpcoming: startsAt ? startsAt.getTime() >= Date.now() : false,
    };
}
