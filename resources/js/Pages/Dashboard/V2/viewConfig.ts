/**
 * The v2 dashboard views, their names and what each one claims to show.
 *
 * Shared by the personal dashboard and the role-scoped shell because both now
 * render the same switcher from the same header — two copies of these labels
 * would let "Team" and "Downline" drift apart between the page you switch from
 * and the page you land on.
 *
 * Static and hook-free: English defaults here. Switcher labels and role-view
 * subtext / period copy are resolved with t("pages.dashboard.views.*") at the
 * render site.
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
    // Every enabled lead agent with an active account — a manager of agents,
    // not a team lead looking down their tree. Team is the downline surface.
    manager: "Manager",
    // The whole sub-agent network below you — what the business means by
    // "your team".
    team: "Team",
    leadership: "Company",
    partner: "Partner",
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

/** Resolve switcher labels from pages.dashboard.views.* via t(). */
export function localizeSwitcherSegments(
    segments: SwitcherSegment[],
    t: (key: string) => string,
): SwitcherSegment[] {
    return segments.map((seg) => ({
        ...seg,
        label: t(`pages.dashboard.views.${seg.value}`),
        ...(seg.title ? { title: t("pages.dashboard.views.coming_soon") } : {}),
    }));
}

/**
 * Presets offered by the range picker. Rolling day counts must match
 * DashboardDateRange::PRESETS; named keys must match NAMED_PRESETS.
 *
 * A rolling preset moves with today, so picking one sends ?days=N rather than
 * the two dates it currently resolves to. YTD / all-time send ?period= so the
 * server re-resolves them each visit. Anything else the user drags out is
 * sent as ?from=&to=.
 */
export type NamedPeriod = "ytd" | "all";

export type RangePreset = number | NamedPeriod;

/** Lang key suffix under pages.dashboard.views.period.* */
export type PeriodLabelKey =
    | "past_week"
    | "past_month"
    | "past_quarter"
    | "past_year"
    | "ytd"
    | "all";

export type PeriodOption =
    | { days: number; periodKey: PeriodLabelKey; key?: undefined }
    | { key: NamedPeriod; periodKey: PeriodLabelKey; days?: undefined };

export const PERIODS: PeriodOption[] = [
    { days: 7, periodKey: "past_week" },
    { days: 30, periodKey: "past_month" },
    { days: 90, periodKey: "past_quarter" },
    { days: 365, periodKey: "past_year" },
    { key: "ytd", periodKey: "ytd" },
    { key: "all", periodKey: "all" },
];

/** Floor shared with DashboardDateRange::ALL_TIME_FROM. */
export const ALL_TIME_FROM = "2000-01-01";

/** The window a view is being read over, as the server resolved it. */
export interface DashboardRange {
    from: string;
    to: string;
    days: number;
    /** Null when the user picked their own dates. */
    preset: RangePreset | null;
}

type Translate = (key: string, replaces?: Record<string, string | number>) => string;

/** Period label for the picker / subtext — already localized via t(). */
export function periodLabel(
    option: PeriodOption,
    t: Translate,
): string {
    return t(`pages.dashboard.views.period.${option.periodKey}`);
}

/**
 * Window fragment for the greeting subtext. English period keys live in the
 * lang files; the trailing period is part of the sentence, not the picker label.
 */
export function windowLabel(range: DashboardRange, t: Translate): string {
    if (range.preset === "ytd" || range.preset === "all") {
        return `${t(`pages.dashboard.views.period.${range.preset}`)}.`;
    }

    if (typeof range.preset === "number") {
        const match = PERIODS.find(
            (option) => "days" in option && option.days === range.preset,
        );

        if (match) {
            return `${periodLabel(match, t)}.`;
        }

        return `${t("pages.dashboard.views.period.last_days", { days: range.preset })}.`;
    }

    return `${t("pages.dashboard.views.period.custom", {
        from: range.from,
        to: range.to,
    })}.`;
}

/** Query params that keep the current window when switching views. */
export function windowParams(
    range: DashboardRange,
): Record<string, string | number> {
    if (range.preset === "ytd" || range.preset === "all") {
        return { period: range.preset };
    }

    if (typeof range.preset === "number") {
        return { days: range.preset };
    }

    return { from: range.from, to: range.to };
}
