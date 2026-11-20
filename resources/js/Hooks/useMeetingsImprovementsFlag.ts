import { usePage } from "@inertiajs/react";

/**
 * crm.meetings-page-improvements — the Meetings page improvements, on top of
 * `crm.meetings-page-redesign`: one definition of Upcoming/Past, calendar as
 * the default view, in-place bulk actions and refresh, one empty state per
 * screen, the lead-first schedule dialog, summaries written by hand and asked
 * for again, and Call on phone meetings.
 *
 * Off, every surface behaves as it did before them. Read from Inertia's shared
 * `featureFlags`, like `useMeetingsPageRedesignFlag`, so the shared meeting
 * components (also used from Deals, Leads and the dashboard) can read it too.
 * The server reads the same flag in `MeetingsController`, so the data the page
 * receives and the way it draws it are always in step.
 */
export default function useMeetingsImprovementsFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return (
        featureFlags["crm.meetings-page-redesign"] === true &&
        featureFlags["crm.meetings-page-improvements"] === true
    );
}
