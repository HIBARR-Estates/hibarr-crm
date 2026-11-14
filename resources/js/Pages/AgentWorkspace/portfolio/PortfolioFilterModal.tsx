import { useEffect, useMemo } from "react";
import { useFilter } from "@/contexts/FilterContext";
import EntityFilterModal from "@/Features/Filters/EntityFilterModal";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { createBrowseFilterConfig, createProjectsFilterConfig } from "./portfolioFilterConfig";
import type { BrowseOptions, ProjectOptions } from "./types";

interface PortfolioFilterModalProps {
    view: "browse" | "projects";
    options?: BrowseOptions | ProjectOptions;
    total: number;
    /** Changes whenever the applied filters do, so the modal re-reads the URL. */
    appliedKey: string;
}

/**
 * The Portfolio's filter modal for Browse and Projects: the workspace's shared
 * filter modal (the one Deals and People use) with this page's fields. Loaded
 * the first time Filters is pressed, so the page never pays for it up front.
 */
export default function PortfolioFilterModal(props: PortfolioFilterModalProps) {
    // The fields' choices come with the deferred options. Opening only once they are here keeps a late
    // arrival from rebuilding the form under a selection the agent has already made.
    return props.options ? <PortfolioFilterModalBody {...props} /> : null;
}

function PortfolioFilterModalBody({ view, options, total, appliedKey }: PortfolioFilterModalProps) {
    const { openDrawer } = useFilter();

    const filterConfig = useMemo(
        () => (view === "browse" ? createBrowseFilterConfig(options as BrowseOptions | undefined) : createProjectsFilterConfig(options as ProjectOptions | undefined)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [view, options, appliedKey],
    );

    usePageSearchAndFilter({ filterConfig });

    // Pressing Filters is what mounts this, so it opens as soon as it exists.
    useEffect(() => {
        // After the config effect above has read the URL into the draft.
        const handle = window.setTimeout(openDrawer, 0);
        return () => window.clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <EntityFilterModal config={filterConfig} optionsLoading={false} entityLabel={view === "browse" ? "properties" : "projects"} currentCount={total} savedViews={false} />;
}
