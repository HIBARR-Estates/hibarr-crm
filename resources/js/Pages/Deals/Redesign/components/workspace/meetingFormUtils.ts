import type { Deal } from "@/Types/api/deals";
import type { DealFollowup, Reminder } from "@/Types/api/deal-followup";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export const MEETING_DURATION_OPTIONS = [
    { value: 15, label: "15 min" },
    { value: 30, label: "30 min" },
    { value: 45, label: "45 min" },
    { value: 60, label: "1 hr" },
    { value: 90, label: "1.5 hrs" },
    { value: 120, label: "2 hrs" },
    { value: 180, label: "3 hrs" },
    { value: 240, label: "4 hrs" },
] as const;

export const MEETING_PLATFORM_OPTIONS = [
    { value: "zoho", label: "Video call" },
    { value: "physical", label: "In person" },
    { value: "phone", label: "Phone" },
    { value: "office", label: "Office" },
] as const;

export type MeetingPlatform = (typeof MEETING_PLATFORM_OPTIONS)[number]["value"];

export interface MeetingFormState {
    meetingTypeId: number | null;
    date: string;
    startTime: string;
    endTime: string;
    duration: number | null;
    platform: MeetingPlatform;
    meetingLink: string;
    participants: number[];
    remark: string;
    reminders: Reminder[];
}

export const DEFAULT_MEETING_REMINDERS: Reminder[] = [
    { time: 1, type: "hour", is_default: true },
    { time: 30, type: "minute", is_default: true },
    { time: 15, type: "minute", is_default: true },
    { time: 5, type: "minute", is_default: true },
];

export function formatMeetingDateForApi(isoDate: string): string {
    const [year, month, day] = isoDate.split("-");
    return `${day}-${month}-${year}`;
}

export function formatMeetingTimeForApi(time: string): string {
    if (!time) return "";
    return time.length === 5 ? `${time}:00` : time;
}

export function addMinutesToTime(time: string, minutes: number): string {
    const [hours = 0, mins = 0] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;

    return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

export function diffMinutesBetweenTimes(
    startTime: string,
    endTime: string,
): number | null {
    if (!startTime || !endTime) return null;

    const [startHours = 0, startMinutes = 0] = startTime.split(":").map(Number);
    const [endHours = 0, endMinutes = 0] = endTime.split(":").map(Number);
    let diff = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);

    if (diff <= 0) {
        diff += 24 * 60;
    }

    return diff > 0 ? diff : null;
}

export function isMeetingStartInFuture(
    isoDate: string,
    startTime: string,
): boolean {
    if (!isoDate || !startTime) return false;

    const selected = new Date(`${isoDate}T${startTime}:00`);
    const minimum = new Date(Date.now() + 5 * 60 * 1000);

    return selected.getTime() >= minimum.getTime();
}

export function getDefaultMeetingParticipants(
    deal: Deal,
    currentUserId?: number,
): number[] {
    const ids: number[] = [];

    if (currentUserId) {
        ids.push(currentUserId);
    }

    deal.deal_participants?.forEach((participant) => {
        if (participant.id && !ids.includes(participant.id)) {
            ids.push(participant.id);
        }
    });

    deal.deal_watchers?.forEach((watcher) => {
        if (watcher.id && !ids.includes(watcher.id)) {
            ids.push(watcher.id);
        }
    });

    return ids;
}

export function buildEmptyMeetingForm(
    deal: Deal,
    currentUserId?: number,
): MeetingFormState {
    return {
        meetingTypeId: null,
        date: "",
        startTime: "",
        endTime: "",
        duration: null,
        platform: "zoho",
        meetingLink: "",
        participants: getDefaultMeetingParticipants(deal, currentUserId),
        remark: "",
        reminders: [],
    };
}

export function formatDefaultRemindersLabel(reminders: Reminder[]): string {
    return reminders
        .map((reminder) => {
            const unit =
                reminder.type === "hour"
                    ? reminder.time === 1
                        ? "hour"
                        : "hours"
                    : reminder.type === "minute"
                      ? reminder.time === 1
                          ? "minute"
                          : "minutes"
                      : reminder.type === "day"
                        ? reminder.time === 1
                            ? "day"
                            : "days"
                        : reminder.type;

            return `${reminder.time} ${unit}`;
        })
        .join(", ");
}

function toIsoDate(value: dayjs.Dayjs): string {
    return value.format("YYYY-MM-DD");
}

function toTimeValue(value: dayjs.Dayjs): string {
    return value.format("HH:mm");
}

export function buildMeetingFormFromFollowup(
    followup: DealFollowup,
    deal: Deal,
    currentUserId?: number,
): MeetingFormState {
    const localDate = dayjs.utc(followup.next_follow_up_date).local();
    const duration =
        followup.duration ?? followup.effective_duration ?? 30;
    const startTime = toTimeValue(localDate);
    const customReminders =
        followup.reminders?.filter((reminder) => !reminder.is_default) ?? [];

    return {
        meetingTypeId: followup.meeting_type?.id ?? null,
        date: toIsoDate(localDate),
        startTime,
        endTime: addMinutesToTime(startTime, duration),
        duration,
        platform: (followup.location || "zoho") as MeetingPlatform,
        meetingLink: followup.meeting_link || "",
        participants:
            followup.participants?.length && followup.participants.length > 0
                ? followup.participants
                : getDefaultMeetingParticipants(deal, currentUserId),
        remark: followup.remark || "",
        reminders: customReminders,
    };
}

export function buildRescheduleFormFromFollowup(followup: DealFollowup): {
    date: string;
    startTime: string;
    endTime: string;
    duration: number | null;
} {
    const localDate = dayjs.utc(followup.next_follow_up_date).local();
    const duration =
        followup.duration ?? followup.effective_duration ?? 30;
    const startTime = toTimeValue(localDate);

    return {
        date: toIsoDate(localDate),
        startTime,
        endTime: addMinutesToTime(startTime, duration),
        duration,
    };
}
