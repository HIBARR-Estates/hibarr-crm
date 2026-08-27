import { usePage } from "@inertiajs/react";

/**
 * crm.tasks-workspace-redesign — globally shared via Inertia's featureFlags
 * prop (see HandleInertiaRequests), so this reads the same way from any
 * page, not just the Tasks workspace itself. Mirrors useExposeShareLinksFlag.
 */
export default function useTasksWorkspaceRedesignFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags["crm.tasks-workspace-redesign"] === true;
}
