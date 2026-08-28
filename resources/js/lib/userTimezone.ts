import axios from "axios";

const SESSION_KEY = "user_timezone_capture_attempted";

export function getBrowserTimezone(): string {
    try {
        return (
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        );
    } catch {
        return "UTC";
    }
}

function isTimezoneLocked(locked: boolean | number | null | undefined): boolean {
    return locked === true || locked === 1;
}

/**
 * Persist browser IANA timezone at most once per browser session.
 * Writes when stored timezone is empty or differs from the browser zone.
 * Skips entirely when the user has locked an explicit timezone override.
 */
export function persistUserTimezoneOnce(
    storedTimezone: string | null | undefined,
    timezoneLocked?: boolean | number | null,
): void {
    if (typeof window === "undefined") {
        return;
    }

    if (isTimezoneLocked(timezoneLocked)) {
        return;
    }

    try {
        if (sessionStorage.getItem(SESSION_KEY)) {
            return;
        }
        sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
        // sessionStorage unavailable — still attempt a single write this call
    }

    const browserTimezone = getBrowserTimezone();

    if (
        typeof storedTimezone === "string" &&
        storedTimezone !== "" &&
        storedTimezone === browserTimezone
    ) {
        return;
    }

    axios
        .post("/account/settings/profile/timezone", {
            timezone: browserTimezone,
        })
        .catch(() => {
            // Capture must never block UX
        });
}
