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

/** Top-level place/mode the user picks first. */
export type MeetingMode = "video" | "physical" | "phone";

/**
 * Backend `location` values the redesign UI can create/edit.
 * Video providers map 1:1 onto FollowUp StoreRequest locations.
 * Physical: `office` = HIBARR HQ; `physical` = other (custom text sent as location).
 */
export type VideoProvider = "zoho" | "google_meet" | "zoom" | "teams";
export type PhysicalVenue = "office" | "physical";
export type MeetingPlatform = VideoProvider | PhysicalVenue | "phone";

export const MEETING_MODE_OPTIONS = [
    { value: "video" as const, label: "Video call" },
    { value: "physical" as const, label: "Physical" },
    { value: "phone" as const, label: "Phone" },
];

/** @deprecated Prefer MEETING_MODE_OPTIONS — kept for any legacy imports. */
export const MEETING_PLATFORM_OPTIONS = [
    { value: "zoho" as const, label: "Video call" },
    { value: "office" as const, label: "Physical" },
    { value: "phone" as const, label: "Phone" },
];

export const PHYSICAL_VENUE_OPTIONS: Array<{
    value: PhysicalVenue;
    label: string;
}> = [
    { value: "office", label: "HIBARR HQ" },
    { value: "physical", label: "Other location" },
];

/** Known location enum values stored by the API (not free-text places). */
export const KNOWN_MEETING_LOCATIONS = [
    "office",
    "zoom",
    "zoho",
    "zoho_meet",
    "google_meet",
    "teams",
    "meet",
    "phone",
    "physical",
    "skype",
    "other",
] as const;

export const VIDEO_PROVIDER_OPTIONS: Array<{
    value: VideoProvider;
    label: string;
    /** Icons8 CDN — same sources as legacy follow-up UI. */
    logoUrl: string;
}> = [
    {
        value: "zoho",
        label: "Zoho Meeting",
        // Icons8's zoho.png is 404; use Zoho's product logo.
        logoUrl:
            "https://www.zohowebstatic.com/sites/zweb/images/productlogos/meeting.svg",
    },
    {
        value: "google_meet",
        label: "Google Meet",
        logoUrl: "https://img.icons8.com/color/48/000000/google-meet.png",
    },
    {
        value: "zoom",
        label: "Zoom",
        logoUrl: "https://img.icons8.com/color/48/000000/zoom.png",
    },
    {
        value: "teams",
        label: "Microsoft Teams",
        logoUrl: "https://img.icons8.com/color/48/000000/microsoft-teams.png",
    },
];

export function isVideoPlatform(platform: MeetingPlatform | string): boolean {
    return (
        platform === "zoho" ||
        platform === "zoho_meet" ||
        platform === "google_meet" ||
        platform === "meet" ||
        platform === "zoom" ||
        platform === "teams"
    );
}

/** Zoho Meeting: link is generated server-side after schedule. */
export function usesAutoMeetingLink(
    platform: MeetingPlatform | string,
): boolean {
    return platform === "zoho" || platform === "zoho_meet";
}

/** Non-Zoho video: user must paste a link from their provider. */
export function requiresManualMeetingLink(
    platform: MeetingPlatform | string,
): boolean {
    return isVideoPlatform(platform) && !usesAutoMeetingLink(platform);
}

/** Backend requires participants when location === zoho. */
export function requiresMeetingParticipants(
    platform: MeetingPlatform | string,
): boolean {
    return usesAutoMeetingLink(platform);
}

/** Zoho Meeting auto-link / calendar sync is limited to @hibarr.de accounts. */
export const ZOHO_MEETING_EMAIL_DOMAIN = "hibarr.de";

export function canUseZohoMeeting(email?: string | null): boolean {
    if (!email) return false;
    const domain = email.trim().toLowerCase().split("@")[1] ?? "";
    return domain === ZOHO_MEETING_EMAIL_DOMAIN;
}

/** First available video provider — Zoho when allowed, otherwise Google Meet. */
export function defaultVideoProvider(
    emailOrCanUseZoho?: string | null | boolean,
): VideoProvider {
    const allowed =
        typeof emailOrCanUseZoho === "boolean"
            ? emailOrCanUseZoho
            : canUseZohoMeeting(emailOrCanUseZoho);
    return allowed ? "zoho" : "google_meet";
}

export function isPhysicalPlatform(
    platform: MeetingPlatform | string,
): boolean {
    return (
        platform === "office" ||
        platform === "physical" ||
        (!isVideoPlatform(platform) &&
            platform !== "phone" &&
            Boolean(platform))
    );
}

/** Other location requires a typed place name. */
export function requiresPhysicalLocationDetail(
    platform: MeetingPlatform | string,
): boolean {
    return platform === "physical";
}

export function modeFromPlatform(
    platform: MeetingPlatform | string,
): MeetingMode {
    if (platform === "phone") return "phone";
    if (isVideoPlatform(platform)) return "video";
    if (isPhysicalPlatform(platform)) return "physical";
    return "video";
}

export function defaultPlatformForMode(
    mode: MeetingMode,
    emailOrCanUseZoho?: string | null | boolean,
): MeetingPlatform {
    if (mode === "physical") return "office";
    if (mode === "phone") return "phone";
    return defaultVideoProvider(emailOrCanUseZoho);
}

export function videoProviderLabel(
    platform: MeetingPlatform | string,
): string {
    const match = VIDEO_PROVIDER_OPTIONS.find(
        (option) =>
            option.value === platform ||
            (platform === "zoho_meet" && option.value === "zoho") ||
            (platform === "meet" && option.value === "google_meet"),
    );
    return match?.label ?? "Video call";
}

export interface MeetingFormState {
    meetingTypeId: number | null;
    date: string;
    startTime: string;
    endTime: string;
    duration: number | null;
    platform: MeetingPlatform;
    /** Typed place when platform is Other location (`physical`). */
    locationDetail: string;
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
    userEmail?: string | null,
): MeetingFormState {
    return {
        meetingTypeId: null,
        date: "",
        startTime: "",
        endTime: "",
        duration: null,
        platform: defaultVideoProvider(userEmail),
        locationDetail: "",
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

/**
 * Maps a stored `location` onto a redesign MeetingPlatform.
 * Free-text physical places map to `physical` (detail kept separately).
 */
export function normalizePlatform(
    location: string | undefined,
): MeetingPlatform {
    switch (location) {
        case "office":
            return "office";
        case "physical":
            return "physical";
        case "phone":
            return "phone";
        case "zoho":
        case "zoho_meet":
            return "zoho";
        case "google_meet":
        case "meet":
            return "google_meet";
        case "zoom":
            return "zoom";
        case "teams":
            return "teams";
        case "skype":
        case "other":
            return "zoho";
        default:
            if (isVideoPlatform(location || "")) return "zoho";
            // Custom physical place name stored in `location`.
            return location?.trim() ? "physical" : "office";
    }
}

export function locationDetailFromFollowup(
    location: string | undefined,
): string {
    if (!location) return "";
    if ((KNOWN_MEETING_LOCATIONS as readonly string[]).includes(location)) {
        return "";
    }
    return location;
}

/** Value written to FollowUp `location`. */
export function locationForPayload(
    platform: MeetingPlatform,
    locationDetail: string,
): string {
    if (platform === "physical") {
        // Prefer typed place; fall back to enum for legacy rows / cancel flows.
        return locationDetail.trim() || "physical";
    }
    return platform;
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
        locationDetail: locationDetailFromFollowup(followup.location),
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

/** Payload helper: only video platforms send a meeting_link. */
export function meetingLinkForPayload(
    platform: MeetingPlatform,
    meetingLink: string,
): string {
    if (!isVideoPlatform(platform)) return "";
    return meetingLink.trim();
}
