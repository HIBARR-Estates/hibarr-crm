import { useEffect } from "react";
import { usePage } from "@inertiajs/react";
import { persistUserTimezoneOnce } from "@/lib/userTimezone";

/**
 * Captures the authenticated user's browser timezone once per session.
 */
export default function UserTimezoneCapture() {
    const { props } = usePage();

    const user = props.auth?.user;

    useEffect(() => {
        if (!user) {
            return;
        }
        persistUserTimezoneOnce(user.timezone);
    }, [user]);

    return null;
}
