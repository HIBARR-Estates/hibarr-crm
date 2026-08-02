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

// "office" is a valid, distinct backend location value (FollowUp\StoreRequest)
// but v2.2 doesn't ask the user to distinguish it from a generic in-person
// meeting — merged into one "In person" choice. buildMeetingFormFromFollowup
// below maps existing "office" meetings onto "physical" so they still show
// correctly selected when reopened for editing.
export const MEETING_PLATFORM_OPTIONS = [
    { value: "zoho", label: "Video call" },
    { value: "physical", label: "In person" },
    { value: "phone", label: "Phone" },
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

/** Accepts Deal-shaped (`deal_participants`/`deal_watchers`) or generic lists. */
export interface MeetingParticipantSource {
    deal_participants?: Array<{ id?: number } | null> | null;
    deal_watchers?: Array<{ id?: number } | null> | null;
    participants?: Array<{ id?: number } | null> | null;
    watchers?: Array<{ id?: number } | null> | null;
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

function collectIds(
    people: Array<{ id?: number } | null> | null | undefined,
    ids: number[],
): void {
    people?.forEach((person) => {
        if (person?.id && !ids.includes(person.id)) {
            ids.push(person.id);
        }
    });
}

export function getDefaultMeetingParticipants(
    source: MeetingParticipantSource | null | undefined,
    currentUserId?: number,
): number[] {
    const ids: number[] = [];

    if (currentUserId) {
        ids.push(currentUserId);
    }

    collectIds(source?.deal_participants ?? source?.participants, ids);
    collectIds(source?.deal_watchers ?? source?.watchers, ids);

    return ids;
}

export function buildEmptyMeetingForm(
    source: MeetingParticipantSource | null | undefined,
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
        participants: getDefaultMeetingParticipants(source, currentUserId),
        remark: "",
        reminders: [],
    };
}

/** v2.2 reminderLabel (deal-v2-2.jsx:2281-2283). */
export function reminderLabel(reminder: Reminder): string {
    return `${reminder.time} ${reminder.type}${reminder.time > 1 ? "s" : ""} before`;
}

/** Maps a stored `location` onto a value the (merged) platform selector
 * actually offers — legacy "office" meetings become "In person". */
function normalizePlatform(location: string | undefined): MeetingPlatform {
    if (location === "office") return "physical";
    return (location || "zoho") as MeetingPlatform;
}

function toIsoDate(value: dayjs.Dayjs): string {
    return value.format("YYYY-MM-DD");
}

function toTimeValue(value: dayjs.Dayjs): string {
    return value.format("HH:mm");
}

export function buildMeetingFormFromFollowup(
    followup: DealFollowup,
    source: MeetingParticipantSource | null | undefined,
    currentUserId?: number,
): MeetingFormState {
    const localDate = dayjs.utc(followup.next_follow_up_date).local();
    const duration = followup.duration ?? followup.effective_duration ?? 30;
    const startTime = toTimeValue(localDate);
    const customReminders =
        followup.reminders?.filter((reminder) => !reminder.is_default) ?? [];

    return {
        meetingTypeId: followup.meeting_type?.id ?? null,
        date: toIsoDate(localDate),
        startTime,
        endTime: addMinutesToTime(startTime, duration),
        duration,
        platform: normalizePlatform(followup.location),
        meetingLink: followup.meeting_link || "",
        participants:
            followup.participants?.length && followup.participants.length > 0
                ? followup.participants
                : getDefaultMeetingParticipants(source, currentUserId),
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
    const duration = followup.duration ?? followup.effective_duration ?? 30;
    const startTime = toTimeValue(localDate);

    return {
        date: toIsoDate(localDate),
        startTime,
        endTime: addMinutesToTime(startTime, duration),
        duration,
    };
}
