import { useState } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import Switch from "@/Components/Redesign/primitives/Switch";
import NotificationAlertSettings from "@/Components/NotificationAlertSettings";
import { useNotificationAlertSettings } from "@/contexts/NotificationAlertSettingsContext";
import useTranslation from "@/Hooks/useTranslation";
import NotificationBypassList, { type BypassType } from "@/Pages/Settings/components/NotificationBypassList";
import { PrefCard, PrefRow } from "./PrefCard";

export interface NotificationPreferencesData {
    bypassEnabled: boolean;
    bypassTypes: BypassType[];
    bypassedKeys: string[];
}

/**
 * Notifications: the pop-up alerts while you work (their switch, position and
 * duration save to the account as they change) and which events notify you,
 * when the company has that switched on.
 */
export default function NotificationsCard({ data }: { data: NotificationPreferencesData | undefined }) {
    const { t } = useTranslation();
    const {
        settings: { alerts_muted: muted },
        setAlertsMuted,
    } = useNotificationAlertSettings();
    const [customise, setCustomise] = useState(false);
    const [eventsOpen, setEventsOpen] = useState(false);

    return (
        <PrefCard title={t("pages.agent_workspace.prefs.notifications.title")}>
            <PrefRow
                title={t("pages.agent_workspace.prefs.notifications.alerts")}
                text={t("pages.agent_workspace.prefs.notifications.alerts_text")}
            >
                <Switch
                    checked={!muted}
                    onChange={() => setAlertsMuted(!muted)}
                    aria-label={t("pages.agent_workspace.prefs.notifications.alerts")}
                />
            </PrefRow>

            {!muted ? (
                <div className="agent-pr__more">
                    <Button size="sm" variant="ghost" aria-expanded={customise} onClick={() => setCustomise((open) => !open)}>
                        {t("pages.agent_workspace.prefs.notifications.customise")}
                        <Icon name={customise ? "chevron-up" : "chevron-down"} size={13} />
                    </Button>
                    {customise ? (
                        <div className="agent-pr__alert-settings">
                            <NotificationAlertSettings />
                        </div>
                    ) : null}
                </div>
            ) : null}

            {data?.bypassEnabled ? (
                <PrefRow
                    title={t("pages.agent_workspace.prefs.notifications.events")}
                    text={t("pages.agent_workspace.prefs.notifications.events_text")}
                >
                    <Button size="sm" onClick={() => setEventsOpen(true)}>
                        {t("pages.agent_workspace.prefs.notifications.open")}
                        <Icon name="chevron-right" size={13} />
                    </Button>
                </PrefRow>
            ) : null}

            {data?.bypassEnabled ? (
                <Modal
                    open={eventsOpen}
                    title={t("pages.agent_workspace.prefs.notifications.events")}
                    subtitle={t("pages.agent_workspace.prefs.notifications.events_hint")}
                    onClose={() => setEventsOpen(false)}
                    maxWidth={640}
                    closeOnBackdrop
                >
                    <NotificationBypassList types={data.bypassTypes} initialBypassedKeys={data.bypassedKeys} />
                </Modal>
            ) : null}
        </PrefCard>
    );
}
