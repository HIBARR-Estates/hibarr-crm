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
