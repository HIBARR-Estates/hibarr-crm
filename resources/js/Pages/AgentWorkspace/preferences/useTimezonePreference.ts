import { useState } from "react";
import axios from "axios";
import { App } from "antd";
import { router } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { isUserDateTimeEnabled, setUserDateTimeContext } from "@/lib/userDateTime";
import { errorMessage } from "./errorMessage";

/** Hardcoded, as on the classic page, so a missing Ziggy name cannot unmount the screen. */
const TIMEZONE_SAVE_URL = "/account/settings/preferences/timezone";

type Source = "picker" | "browser";

/**
 * The person's CRM time zone and whether it follows the browser. Both save as
 * soon as they change, through the classic Preferences endpoint, and the
 * viewer's zone is patched into the page props so times update without a reload.
 */
export default function useTimezonePreference(initialTimezone: string | null, initialLocked: boolean) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [timezone, setTimezone] = useState(initialTimezone && initialTimezone !== "" ? initialTimezone : "UTC");
    const [locked, setLocked] = useState(initialLocked);
    const [saving, setSaving] = useState<Source | null>(null);

    const save = async (nextTimezone: string, nextLocked: boolean, source: Source) => {
        const previous = { timezone, locked };
        setTimezone(nextTimezone);
        setLocked(nextLocked);
        setSaving(source);
        try {
            const { data } = await axios.post<{ timezone?: string; timezoneLocked?: boolean }>(TIMEZONE_SAVE_URL, {
                timezone: nextTimezone,
                locked: nextLocked,
            });
            const savedTimezone = data.timezone ?? nextTimezone;
            const savedLocked = data.timezoneLocked ?? nextLocked;
            setTimezone(savedTimezone);
            setLocked(savedLocked);
            setUserDateTimeContext({ enabled: isUserDateTimeEnabled(), timezone: savedTimezone });
            router.replace({
                preserveScroll: true,
                preserveState: true,
                props: (current) => ({
                    ...current,
                    viewerTimezone: savedTimezone,
                    auth: current.auth
                        ? { ...current.auth, user: { ...current.auth.user, timezone: savedTimezone, timezone_locked: savedLocked } }
                        : current.auth,
                }),
            });
        } catch (error) {
            setTimezone(previous.timezone);
            setLocked(previous.locked);
            message.error(errorMessage(error, t("messages.somethingWentWrong")));
        } finally {
            setSaving(null);
        }
    };

    return { timezone, locked, saving, save };
}
