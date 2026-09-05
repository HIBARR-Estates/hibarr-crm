/**
 * The v2 dashboard views, their names and what each one claims to show.
 *
 * Shared by the personal dashboard and the role-scoped shell because both now
 * render the same switcher from the same header — two copies of these labels
 * would let "Team" and "Downline" drift apart between the page you switch from
 * and the page you land on.
 *
 * Static and hook-free: the strings are English sources, translated with td()
 * at the render site, per the two-tier translation rule.
 *
 * Named viewConfig rather than views so it can't be confused with — or shadow
 * an index of — the sibling views/ directory holding the components.
 */

/** Role-scoped views. Must match DashboardV2Controller::VIEWS. */
export type ViewKey = "agent" | "manager" | "team" | "leadership" | "partner";

/** Every switcher destination, including the personal landing page. */
export type SwitcherKey = ViewKey | "personal";

export const VIEW_LABELS: Record<SwitcherKey, string> = {
    personal: "My work",
    agent: "My work",
    manager: "Team",
    // Not "Team": that is the manager view, one flat level of direct reports.
    // This one walks the whole tree, which is what the business calls a
    // downline.
    team: "Downline",
    leadership: "Company",
    partner: "Partner",
};

/**
 * The line under the greeting on each role view.
 *
 * The personal dashboard doesn't appear here — its subtext is derived from
 * live counts (StatusLine), not written copy.
 */
export const VIEW_SUBTEXT: Record<ViewKey, string> = {
    agent: "Your queue, your week and your pipeline.",
    manager: "How the agents reporting to you are doing.",
    team: "Your whole downline, generation by generation.",
    leadership: "Company-wide movement across every team.",
    partner: "Your referrals only — no deal values.",
};

/** Views whose panels are windowed, and so get the period picker. */
export const WINDOWED: ViewKey[] = ["manager", "team"];

/** Windows offered by the picker. Must match the controller's whitelist. */
export const PERIODS = [
    { days: 30, label: "Last 30 days" },
    { days: 90, label: "Last 90 days" },
    { days: 365, label: "Last 12 months" },
];
