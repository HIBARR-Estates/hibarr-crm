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

/**
 * Persist browser IANA timezone at most once per browser session.
 * Writes when stored timezone is empty or differs from the browser zone.
 */
export function persistUserTimezoneOnce(
    storedTimezone: string | null | undefined,
): void {
    if (typeof window === "undefined") {
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
