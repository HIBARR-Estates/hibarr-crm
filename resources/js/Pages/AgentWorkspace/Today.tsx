import type { ReactNode } from "react";
import { Head, router } from "@inertiajs/react";
import { AgentWorkspaceLayout, CLASSIC_HOME_URL } from "@/Components/Redesign/agent";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";

interface TodayProps {
    pageTitle: string;
    userName: string;
    /** Server time (ISO), read in the viewer's timezone for the greeting and date. */
    now: string;
}

/** Hour of the day in `timeZone` (the browser's own when empty), like the rest of the app. */
function hourIn(now: string, timeZone: string): number {
    const hour = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timeZone || undefined })
        .formatToParts(new Date(now))
        .find((part) => part.type === "hour")?.value;
    return Number(hour ?? new Date(now).getHours());
}

function greetingKey(hour: number): string {
    if (hour < 12) return "pages.agent_workspace.today.greeting_morning";
    if (hour < 18) return "pages.agent_workspace.today.greeting_afternoon";
    return "pages.agent_workspace.today.greeting_evening";
}

/**
 * Today, the agent workspace's home. This first version is the shell only;
 * My work and Agenda land in their own branches as pills under the dock.
 */
export default function Today({ pageTitle, userName, now }: TodayProps) {
    const { t } = useTranslation();
    const { timezone } = useUserDateTime();
    const firstName = userName.split(" ")[0] ?? userName;
    const date = new Date(now).toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: timezone || undefined,
    });

    return (
        <>
            <Head title={pageTitle} />
            <div className="agent-today">
                <div className="agent-today__heading">
                    <h1>{t(greetingKey(hourIn(now, timezone)), { name: firstName })}</h1>
                    <p>{date}</p>
                </div>
                <section className="agent-today__card" aria-label={pageTitle}>
                    <EmptyState
                        icon="calendar"
                        title={t("pages.agent_workspace.today.empty_title")}
                        description={t("pages.agent_workspace.today.empty_description")}
                        action={{
                            label: t("pages.agent_workspace.today.open_classic"),
                            icon: null,
                            onClick: () => router.visit(CLASSIC_HOME_URL),
                        }}
                    />
                </section>
            </div>
        </>
    );
}

Today.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
