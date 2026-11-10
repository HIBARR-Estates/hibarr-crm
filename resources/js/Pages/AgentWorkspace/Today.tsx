import type { ReactNode } from "react";
import { Head, router } from "@inertiajs/react";
import { AgentWorkspaceLayout, CLASSIC_HOME_URL } from "@/Components/Redesign/agent";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";

interface TodayProps {
    pageTitle: string;
    userName: string;
    /** Server time (ISO), so the greeting matches the company clock. */
    now: string;
}

function greetingKey(now: string): string {
    const hour = new Date(now).getHours();
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
    const firstName = userName.split(" ")[0] ?? userName;
    const date = new Date(now).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

    return (
        <>
            <Head title={pageTitle} />
            <div className="agent-today">
                <div className="agent-today__heading">
                    <h1>{t(greetingKey(now), { name: firstName })}</h1>
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
