/**
 * The agent workspace's destinations, in dock order (L7 boards: Today, People,
 * Deals, Tasks, Portfolio, Earnings). A destination whose agent screen is not
 * built yet opens its classic screen (`classicRoute`) until its branch ships;
 * `segment` is the /agent path segment that marks it active (People is active
 * on the contact page, /agent/people/...).
 * Labels are lang keys under pages.agent_workspace.nav, resolved with t().
 */
export interface AgentDestination {
    key: "today" | "people" | "deals" | "tasks" | "portfolio" | "earnings";
    labelKey: string;
    /** Redesign Icon name (tablet dock and phone tab bar). */
    icon: string;
    segment: string;
    /** The agent screen, once it exists. */
    href?: string;
    /** Ziggy route name of the classic screen, used while there is no agent screen. */
    classicRoute?: string;
}

export const AGENT_DESTINATIONS: AgentDestination[] = [
    { key: "today", labelKey: "pages.agent_workspace.nav.today", icon: "home", segment: "today", href: "/agent/today" },
    { key: "people", labelKey: "pages.agent_workspace.nav.people", icon: "users", segment: "people", href: "/agent/people" },
    { key: "deals", labelKey: "pages.agent_workspace.nav.deals", icon: "briefcase", segment: "deals", href: "/agent/deals" },
    { key: "tasks", labelKey: "pages.agent_workspace.nav.tasks", icon: "check-square", segment: "tasks", classicRoute: "tasks.index" },
    { key: "portfolio", labelKey: "pages.agent_workspace.nav.portfolio", icon: "building", segment: "portfolio", href: "/agent/portfolio" },
    { key: "earnings", labelKey: "pages.agent_workspace.nav.earnings", icon: "wallet", segment: "earnings", href: "/agent/earnings" },
];

/** Where a destination opens: its agent screen, else its classic screen (null if that route is missing). */
export function destinationHref(destination: AgentDestination): string | null {
    if (destination.href) return destination.href;
    if (!destination.classicRoute) return null;
    try {
        return route(destination.classicRoute);
    } catch {
        return null;
    }
}

/** The destination a URL belongs to: the first path segment after /agent. */
export function activeDestinationKey(url: string): AgentDestination["key"] | null {
    const segment = url.split("?")[0].split("/")[2] ?? "";
    const match = AGENT_DESTINATIONS.find((destination) => destination.segment === segment);
    return match?.key ?? null;
}

/** Where Classic lives: the CRM home page. */
export const CLASSIC_HOME_URL = "/account/dashboard";
export const AGENT_HOME_URL = "/agent/today";
