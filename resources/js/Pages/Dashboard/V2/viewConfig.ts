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
export type ViewKey = "manager" | "team" | "leadership" | "partner";

/** Every switcher destination, including the personal landing page. */
export type SwitcherKey = ViewKey | "personal";

export const VIEW_LABELS: Record<SwitcherKey, string> = {
    personal: "My work",
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
    manager: "How the agents reporting to you are doing.",
    team: "Your whole downline, generation by generation.",
    leadership: "Company-wide movement across every team.",
    partner: "Your referrals only — no deal values.",
};

/** Views whose panels are windowed, and so get the period picker. */
export const WINDOWED: ViewKey[] = ["manager", "team"];

/**
 * Views that appear in the switcher but can't be opened from it yet.
 *
 * They are built and reachable by URL; they simply aren't part of the
 * three-tab set the dashboard leads with today. Shown greyed rather than
 * omitted so the shape of what's coming is visible — but still only to
 * accounts that hold them, since a tab for a view you'll never be granted is
 * an advertisement, not a signpost.
 */
const COMING_SOON: ViewKey[] = ["leadership", "partner"];

/** Hover text on those, so a greyed tab doesn't read as a broken one. */
const COMING_SOON_TITLE = "Coming soon";

interface SwitcherSegment {
    value: SwitcherKey;
    label: string;
    disabled?: boolean;
    title?: string;
}

/**
 * The switcher, identical on every v2 dashboard.
 *
 * Built here rather than per page because the whole point of the shared
 * header is that switching moves the content under it — a switcher that
 * gained or lost tabs depending on which view you were already looking at
 * would undo that.
 *
 * Two rules:
 *  - Access first. A view the account doesn't hold is absent, never greyed:
 *    availableViews is already the permission- and flag-gated list from
 *    DashboardV2Controller, so anything missing from it must not be hinted at.
 *  - The personal dashboard leads when its flag is on. It is the only "My
 *    work" there is: the old agent view that shared the name is gone.
 */
export function buildSwitcher(
    availableViews: ViewKey[],
    personalDashboardEnabled: boolean,
): SwitcherSegment[] {
    return [
        ...(personalDashboardEnabled
            ? [{ value: "personal" as const, label: VIEW_LABELS.personal }]
            : []),
        ...availableViews.map((view) => ({
            value: view,
            label: VIEW_LABELS[view],
            ...(COMING_SOON.includes(view)
                ? { disabled: true, title: COMING_SOON_TITLE }
                : {}),
        })),
    ];
}

/** Windows offered by the picker. Must match the controller's whitelist. */
export const PERIODS = [
    { days: 30, label: "Last 30 days" },
    { days: 90, label: "Last 90 days" },
    { days: 365, label: "Last 12 months" },
];
