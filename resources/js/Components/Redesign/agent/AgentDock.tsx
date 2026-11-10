import { Link } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "../primitives/Icon";
import { AGENT_DESTINATIONS, type AgentDestination } from "./destinations";

interface AgentDockProps {
    active: AgentDestination["key"] | null;
    /** "dock" = the floating bar (desktop, tablet); "tabs" = the phone's bottom tab bar. */
    variant: "dock" | "tabs";
}

/**
 * Destination links. They prefetch on hover and on press (mousedown/touch)
 * and keep the response for 30s (stale-while-revalidate), so a switch paints
 * at once and refreshes in the background. The layout is persistent, so nothing else on
 * screen remounts.
 */
export default function AgentDock({ active, variant }: AgentDockProps) {
    const { t } = useTranslation();

    return (
        <nav aria-label={t("pages.agent_workspace.dock_label")} className={variant === "dock" ? "agent-dock" : "agent-tabs"}>
            {AGENT_DESTINATIONS.map((destination) => {
                const label = t(destination.labelKey);
                const isActive = destination.key === active;
                return (
                    <Link
                        key={destination.key}
                        href={destination.href}
                        prefetch={["hover", "click"]}
                        cacheFor="30s"
                        preserveScroll={false}
                        aria-current={isActive ? "page" : undefined}
                        className={variant === "dock" ? "agent-dock__item" : "agent-tabs__item"}
                        title={label}
                    >
                        <Icon name={destination.icon} size={variant === "dock" ? 16 : 20} />
                        <span className={variant === "dock" ? "agent-dock__label" : "agent-tabs__label"}>{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
