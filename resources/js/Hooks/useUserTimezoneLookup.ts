import { useCallback, useState } from "react";
import axios from "axios";

/** Hardcoded so a missing Ziggy name cannot break the meeting form. */
const USER_TIMEZONE_URL = (userId: number) =>
    `/account/meetings/user-timezone/${userId}`;

// Per page load — a user's timezone doesn't change while a form is open.
const resolved = new Map<number, string>();

/**
 * Resolves another user's timezone (user → company → UTC) on demand, e.g.
 * the meeting host's when the "Host's timezone" button is clicked. Nothing is
 * fetched until `lookup` is called.
 */
export default function useUserTimezoneLookup() {
    const [loading, setLoading] = useState(false);

    const lookup = useCallback(
        async (userId: number): Promise<string | null> => {
            const cached = resolved.get(userId);
            if (cached) return cached;

            setLoading(true);
            try {
                const { data } = await axios.get<{ timezone?: string }>(
                    USER_TIMEZONE_URL(userId),
                );
                const timezone =
                    typeof data?.timezone === "string" && data.timezone !== ""
                        ? data.timezone
                        : null;
                if (timezone) resolved.set(userId, timezone);
                return timezone;
            } catch {
                return null;
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    return { lookup, loading };
}
