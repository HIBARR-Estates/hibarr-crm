/**
 * Compact labels for an IANA timezone: city name and a live UTC offset
 * (DST-aware). Used by the header timezone chip.
 */

export function timezoneCity(timeZone: string): string {
    const trimmed = timeZone.trim() || "UTC";
    const segment = trimmed.split("/").pop() ?? trimmed;
    if (
        segment === "UTC" ||
        segment === "GMT" ||
        segment === "UCT" ||
        segment === "Etc"
    ) {
        return "UTC";
    }
    return segment.replace(/_/g, " ");
}

export function timezoneUtcOffset(
    timeZone: string,
    at: Date = new Date(),
): string {
    try {
        return formatOffsetMinutes(offsetMinutesInZone(timeZone, at));
    } catch {
        return "UTC";
    }
}

export function timezoneChipLabel(
    timeZone: string,
    at: Date = new Date(),
): string {
    const city = timezoneCity(timeZone);
    const offset = timezoneUtcOffset(timeZone, at);
    if (city === "UTC" && offset === "UTC") {
        return "UTC";
    }
    return `${city} · ${offset}`;
}

/**
 * Short timezone name for a wall clock (CET, EAT, GMT+3).
 * Falls back to a live UTC offset when Intl has no abbreviation.
 */
export function timezoneShortName(
    timeZone: string,
    at: Date = new Date(),
): string {
    const trimmed = timeZone.trim() || "UTC";
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: trimmed,
            timeZoneName: "short",
        }).formatToParts(at);
        const name = parts.find((part) => part.type === "timeZoneName")?.value;
        if (name && name.trim() !== "") {
            return name.trim();
        }
    } catch {
        // Invalid IANA zone — fall through to offset.
    }
    return timezoneUtcOffset(trimmed, at);
}

function offsetMinutesInZone(timeZone: string, date: Date): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(date);

    const value = (type: Intl.DateTimeFormatPartTypes): number => {
        const part = parts.find((item) => item.type === type);
        return part ? Number(part.value) : 0;
    };

    const asUtc = Date.UTC(
        value("year"),
        value("month") - 1,
        value("day"),
        value("hour"),
        value("minute"),
        value("second"),
    );

    return Math.round((asUtc - date.getTime()) / 60000);
}

function formatOffsetMinutes(total: number): string {
    if (total === 0) {
        return "UTC";
    }
    const sign = total > 0 ? "+" : "-";
    const abs = Math.abs(total);
    const hours = Math.floor(abs / 60);
    const minutes = abs % 60;
    if (minutes === 0) {
        return `UTC${sign}${hours}`;
    }
    return `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}
