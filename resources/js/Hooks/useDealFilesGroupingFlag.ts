import { usePage } from "@inertiajs/react";

/**
 * crm.deal-files-grouping — globally shared via Inertia's featureFlags prop
 * (see HandleInertiaRequests), so this reads the same way from any page.
 * When on: the Lead Files tab groups deal-owned cross-populated file fields
 * into collapsible per-deal sub-sections instead of one flat list, and both
 * the Deal and Lead Files tabs move their upload dropzone to the top.
 * Mirrors useTasksWorkspaceRedesignFlag.
 */
export default function useDealFilesGroupingFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags["crm.deal-files-grouping"] === true;
}
