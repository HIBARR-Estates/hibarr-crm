/**
 * The agent workspace's destinations, in dock order. A destination is listed
 * only once its screen exists (`href` set); later branches add theirs here.
 * Labels are lang keys under pages.agent_workspace.nav, resolved with t().
 */
export interface AgentDestination {
    key: "today" | "people" | "deals" | "tasks" | "portfolio" | "earnings";
    labelKey: string;
    /** Redesign Icon name. */
    icon: string;
    href: string;
}

export const AGENT_DESTINATIONS: AgentDestination[] = [
    { key: "today", labelKey: "pages.agent_workspace.nav.today", icon: "home", href: "/agent/today" },
];

/** The destination a URL belongs to: the first path segment after /agent. */
export function activeDestinationKey(url: string): AgentDestination["key"] | null {
    const segment = url.split("?")[0].split("/")[2] ?? "";
    const match = AGENT_DESTINATIONS.find((destination) => destination.href.split("/")[2] === segment);
    return match?.key ?? null;
}

/** Where Classic lives: the CRM home page. */
export const CLASSIC_HOME_URL = "/account/dashboard";
export const AGENT_HOME_URL = "/agent/today";
