import { useEffect } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { useSearch } from "@/contexts/SearchContext";
import { FilterConfig } from "@/contexts/FilterContext";
import { SearchConfig } from "@/contexts/SearchContext";

interface UsePageSearchAndFilterProps {
    filterConfig: FilterConfig;
    searchConfig: SearchConfig;
}

/**
 * Custom hook that sets up both search and filter contexts for a page
 * This simplifies the setup process for pages that need both functionalities
 */
export const usePageSearchAndFilter = ({
    filterConfig,
    searchConfig,
}: UsePageSearchAndFilterProps) => {
    const { setConfig: setFilterConfig, ...filterContext } = useFilter();
    const { setSearchConfig, ...searchContext } = useSearch();

    // Initialize both contexts
    useEffect(() => {
        setFilterConfig(filterConfig);
        setSearchConfig(searchConfig);
    }, [filterConfig, searchConfig, setFilterConfig, setSearchConfig]);

    return {
        filter: filterContext,
        search: searchContext,
    };
};

export default usePageSearchAndFilter;
