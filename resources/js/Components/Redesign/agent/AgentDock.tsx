import { Link } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "../primitives/Icon";
import { AGENT_DESTINATIONS, destinationHref, type AgentDestination } from "./destinations";

interface AgentDockProps {
    active: AgentDestination["key"] | null;
    /** "dock" = the floating bar (desktop, tablet); "tabs" = the phone's bottom tab bar. */
    variant: "dock" | "tabs";
}

/**
 * Destination links. Agent screens prefetch on hover and on press and keep
 * the response for 30s, so a switch paints at once; the layout is persistent,
 * so nothing else on screen remounts. A destination without an agent screen
 * yet opens its classic screen.
 */
export default function AgentDock({ active, variant }: AgentDockProps) {
    const { t } = useTranslation();
    const itemClass = variant === "dock" ? "agent-dock__item" : "agent-tabs__item";
    const labelClass = variant === "dock" ? "agent-dock__label" : "agent-tabs__label";

    return (
        <>
            {AGENT_DESTINATIONS.map((destination) => {
                const href = destinationHref(destination);
                if (!href) return null;
                const label = t(destination.labelKey);
                const isActive = destination.key === active;
                const content = (
                    <>
                        <Icon name={destination.icon} size={variant === "dock" ? 16 : 20} className={`${itemClass}-icon`} />
                        <span className={labelClass}>{label}</span>
                    </>
                );
                return destination.href ? (
                    <Link
                        key={destination.key}
                        href={href}
                        prefetch={["hover", "click"]}
                        cacheFor="30s"
                        preserveScroll={false}
                        aria-current={isActive ? "page" : undefined}
                        className={itemClass}
                        title={label}
                    >
                        {content}
                    </Link>
                ) : (
                    <a key={destination.key} href={href} aria-current={isActive ? "page" : undefined} className={itemClass} title={label}>
                        {content}
                    </a>
                );
            })}
        </>
    );
}
