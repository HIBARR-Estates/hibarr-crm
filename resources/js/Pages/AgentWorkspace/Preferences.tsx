import { useState, type ReactNode } from "react";
import { Deferred, Head } from "@inertiajs/react";
import { AgentLinkPills, AgentSecondRow, AgentWorkspaceLayout, type AgentLinkPill } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import NotificationsCard, { type NotificationPreferencesData } from "./preferences/NotificationsCard";
import { CardSkeleton } from "./preferences/PrefCard";
import RemindersCard from "./preferences/RemindersCard";
import TimezoneCard from "./preferences/TimezoneCard";
import type { ReminderPreferencesData } from "./preferences/useReminderPreferences";
import "./preferences/preferences.css";

interface PreferencesProps {
    pageTitle: string;
    timezone: string | null;
    timezoneLocked: boolean;
    /** Where the classic settings that stay classic live; left out when the person may not open them. */
    links: { notificationSettings: string | null };
    reminders?: ReminderPreferencesData;
    notifications?: NotificationPreferencesData;
}

/**
 * Preferences (L7-40): the classic Preferences page and Reminder preferences
 * on one screen. Timezone and alerts save as they change; meeting reminders
 * are edited and saved from the bar at the bottom. All of it reads and writes
 * through the classic pages' own endpoints.
 */
export default function Preferences({ pageTitle, timezone, timezoneLocked, links, reminders, notifications }: PreferencesProps) {
    const { t } = useTranslation();
    // Where the reminders' unsaved-changes bar is drawn: full width, below both columns.
    const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);

    const pills: AgentLinkPill[] = [
        { key: "preferences", label: t("pages.agent_workspace.prefs.pills.preferences"), href: "/agent/preferences", current: true },
        ...(links.notificationSettings
            ? [{ key: "notifications", label: t("pages.agent_workspace.prefs.pills.notifications"), href: links.notificationSettings, current: false }]
            : []),
    ];

    return (
        <>
            <Head title={pageTitle} />
            {pills.length > 1 ? (
                <AgentSecondRow>
                    <AgentLinkPills pills={pills} ariaLabel={t("pages.agent_workspace.prefs.pills.label")} />
                </AgentSecondRow>
            ) : null}

            <div className="agent-pr">
                <div className="agent-pr__heading">
                    <h1>{t("pages.agent_workspace.prefs.title")}</h1>
                    <p>{t("pages.agent_workspace.prefs.subtitle")}</p>
                </div>

                <div className="agent-pr__grid">
                    <div className="agent-pr__column">
                        <TimezoneCard timezone={timezone} locked={timezoneLocked} />
                        <Deferred data="notifications" fallback={<NotificationsCard data={undefined} />}>
                            <NotificationsCard data={notifications} />
                        </Deferred>
                    </div>
                    <div className="agent-pr__column">
                        <Deferred data="reminders" fallback={<CardSkeleton rows={3} />}>
                            {reminders ? <RemindersCard data={reminders} barSlot={barSlot} /> : <CardSkeleton rows={3} />}
                        </Deferred>
                    </div>
                </div>
                <div ref={setBarSlot} className="agent-pr__bar-slot" />
            </div>
        </>
    );
}

Preferences.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
