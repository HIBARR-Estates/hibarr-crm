import { useMemo } from "react";
import useTranslation from "@/Hooks/useTranslation";
import type { KeyFactLabels } from "./model";

/** The translated lines key facts are built with, shared by the lead page and its edit page. */
export default function useKeyFactLabels(): KeyFactLabels {
    const { t } = useTranslation();
    return useMemo(
        () => ({
            preferredTime: (time) => t("pages.agent_workspace.contact.best_time", { time }),
            addedBy: (name) => t("pages.agent_workspace.contact.facts.added_by", { name }),
            score: (score) => t("pages.agent_workspace.contact.facts.score", { score }),
            webinarAttended: t("pages.agent_workspace.contact.facts.webinar_attended"),
            webinarRegistered: t("pages.agent_workspace.contact.facts.webinar_registered"),
            lastWebinar: (date) => t("pages.agent_workspace.contact.facts.last_webinar", { date }),
            ebook: t("pages.agent_workspace.contact.facts.ebook"),
        }),
        [t],
    );
}
