import { usePage } from "@inertiajs/react";

/**
 * crm.meetings-page-redesign — globally shared via Inertia's featureFlags
 * prop (see HandleInertiaRequests), so this reads the same way from any
 * page, not just the Meetings index itself. Mirrors useTasksWorkspaceRedesignFlag.
 */
export default function useMeetingsPageRedesignFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags["crm.meetings-page-redesign"] === true;
}
