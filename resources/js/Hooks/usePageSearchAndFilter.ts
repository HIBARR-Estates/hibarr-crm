import { useEffect } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { FilterConfig } from "@/contexts/FilterContext";

interface UsePageSearchAndFilterProps {
    filterConfig: FilterConfig;
    searchConfig?: any; // Deprecated but kept for compatibility
}

/**
 * Custom hook that sets up filter context for a page
 * Search is now handled via FilterContext
 */
export const usePageSearchAndFilter = ({
    filterConfig,
}: UsePageSearchAndFilterProps) => {
    const { setConfig: setFilterConfig, ...filterContext } = useFilter();

    // Initialize filter context
    useEffect(() => {
        setFilterConfig(filterConfig);
    }, [filterConfig, setFilterConfig]);

    return {
        filter: filterContext,
        search: { query: filterContext.filters.search || "" }, // Mock search context for compatibility
    };
};

export default usePageSearchAndFilter;
