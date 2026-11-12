import { useEffect, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";

/**
 * "Saved 4 s ago" for the footer: stamped each time the flow finishes a save
 * (its save signal goes from saving to idle) and kept ticking. Empty until the
 * first save, so the footer never claims a save that did not happen.
 */
export default function useSavedAgo(subscribeSaving: (cb: (saving: boolean) => void) => () => void): string {
    const { t } = useTranslation();
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        let wasSaving = false;
        return subscribeSaving((saving) => {
            if (wasSaving && !saving) {
                setSavedAt(Date.now());
                setNow(Date.now());
            }
            wasSaving = saving;
        });
    }, [subscribeSaving]);

    useEffect(() => {
        if (savedAt === null) return;
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [savedAt]);

    if (savedAt === null) return "";
    const seconds = Math.max(0, Math.floor((now - savedAt) / 1000));
    if (seconds < 2) return t("pages.agent_workspace.flow.saved_now");
    if (seconds < 60) return t("pages.agent_workspace.flow.saved_seconds", { seconds });
    return t("pages.agent_workspace.flow.saved_minutes", { minutes: Math.floor(seconds / 60) });
}
