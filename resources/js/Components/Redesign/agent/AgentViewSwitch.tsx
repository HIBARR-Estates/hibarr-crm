import { router } from "@inertiajs/react";
import "./agent-switch.css";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "../primitives/Icon";
import { AGENT_HOME_URL, CLASSIC_HOME_URL } from "./destinations";

interface AgentViewSwitchProps {
    /** Which view the person is in now. */
    current: "agent" | "classic";
    /** "band" sits on the agent workspace's navy band; "sidebar" in the classic sidebar. */
    tone?: "band" | "sidebar";
    /** Collapsed sidebar: one icon button instead of the two-option switch. */
    compact?: boolean;
}

/**
 * The Agent | Classic switch. Both views are Inertia pages, so switching is a
 * client-side visit; the agent workspace is prefetched on hover so it opens
 * at once.
 */
export default function AgentViewSwitch({ current, tone = "band", compact = false }: AgentViewSwitchProps) {
    const { t } = useTranslation();

    const go = (view: "agent" | "classic") => {
        if (view === current) return;
        router.visit(view === "agent" ? AGENT_HOME_URL : CLASSIC_HOME_URL);
    };

    const prefetchAgent = () => {
        if (current === "classic") router.prefetch(AGENT_HOME_URL, { method: "get" }, { cacheFor: "30s" });
    };

    if (compact) {
        return (
            <button
                type="button"
                className={`agent-switch-compact agent-switch--${tone}`}
                onClick={() => go("agent")}
                onMouseEnter={prefetchAgent}
                onFocus={prefetchAgent}
                title={t("pages.agent_workspace.open_agent")}
                aria-label={t("pages.agent_workspace.open_agent")}
            >
                <Icon name="spark" size={16} />
            </button>
        );
    }

    return (
        <div role="group" aria-label={t("pages.agent_workspace.switch_label")} className={`agent-switch agent-switch--${tone}`}>
            {(["agent", "classic"] as const).map((view) => (
                <button
                    key={view}
                    type="button"
                    className="agent-switch__option"
                    aria-pressed={view === current}
                    onClick={() => go(view)}
                    onMouseEnter={view === "agent" ? prefetchAgent : undefined}
                    onFocus={view === "agent" ? prefetchAgent : undefined}
                    onTouchStart={view === "agent" ? prefetchAgent : undefined}
                >
                    {t(`pages.agent_workspace.${view}`)}
                </button>
            ))}
        </div>
    );
}
