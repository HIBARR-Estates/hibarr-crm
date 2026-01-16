import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    ReactNode,
    useEffect,
} from "react";
import { router } from "@inertiajs/react";

export interface SearchConfig {
    routeName: string;
    placeholder: string;
    searchKeys?: string[]; // Multiple fields to search in
    debounceMs?: number;
    minLength?: number;
    autoSearch?: boolean; // Whether to search on every keystroke
}

interface SearchContextValue {
    // Current search state
    query: string;
    isSearching: boolean;
    searchConfig: SearchConfig | null;

    // Actions
    setQuery: (query: string, immediate?: boolean) => void;
    clearSearch: () => void;
    performSearch: (query?: string) => void;

    // Config management
    setSearchConfig: (config: SearchConfig) => void;

    // Utility methods
    hasActiveSearch: () => boolean;
    getSearchParams: () => Record<string, any>;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export const useSearch = () => {
    const context = useContext(SearchContext);
    if (!context) {
        throw new Error("useSearch must be used within a SearchProvider");
    }
    return context;
};

interface SearchProviderProps {
    children: ReactNode;
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
    const [query, setQueryState] = useState<string>("");
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [searchConfig, setSearchConfigState] = useState<SearchConfig | null>(
        null
    );
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(
        null
    );

    // Initialize search query from URL params
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get("search") || urlParams.get("q") || "";
        if (searchParam) {
            setQueryState(searchParam);
        }
    }, []);

    // Debounced search function
    const debouncedSearch = useCallback(
        (searchQuery: string) => {
            if (!searchConfig) return;

            setIsSearching(true);

            const searchParams = getSearchParams(searchQuery);

            router.get(
                route(searchConfig.routeName),
                {
                    ...searchParams,
                    page: 1, // Reset to first page when searching
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    onFinish: () => setIsSearching(false),
                }
            );
        },
        [searchConfig]
    );

    // Helper function to build search parameters
    const getSearchParams = useCallback(
        (searchQuery?: string): Record<string, any> => {
            const currentQuery =
                searchQuery !== undefined ? searchQuery : query;

            if (!currentQuery.trim()) {
                return {};
            }

            if (
                searchConfig?.searchKeys &&
                searchConfig.searchKeys.length > 0
            ) {
                // If multiple search keys are defined, use the first one as primary
                return { [searchConfig.searchKeys[0]]: currentQuery };
            }

            return { search: currentQuery };
        },
        [query, searchConfig]
    );

    const setQuery = useCallback(
        (newQuery: string, immediate: boolean = false) => {
            setQueryState(newQuery);

            // Clear existing timer
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            // If immediate search or query is empty, search right away
            if (immediate || !newQuery.trim()) {
                debouncedSearch(newQuery);
                return;
            }

            // If auto search is enabled and config is set
            if (searchConfig?.autoSearch) {
                const delay = searchConfig.debounceMs || 300;
                const timer = setTimeout(() => {
                    debouncedSearch(newQuery);
                }, delay);
                setDebounceTimer(timer);
            }
        },
        [debouncedSearch, debounceTimer, searchConfig]
    );

    const clearSearch = useCallback(() => {
        setQuery("", true);
    }, [setQuery]);

    const performSearch = useCallback(
        (searchQuery?: string) => {
            const queryToSearch =
                searchQuery !== undefined ? searchQuery : query;

            // Check minimum length requirement
            if (
                searchConfig?.minLength &&
                queryToSearch.length < searchConfig.minLength
            ) {
                return;
            }

            debouncedSearch(queryToSearch);
        },
        [query, searchConfig, debouncedSearch]
    );

    const setSearchConfig = useCallback((config: SearchConfig) => {
        setSearchConfigState(config);
    }, []);

    const hasActiveSearch = useCallback((): boolean => {
        return query.trim().length > 0;
    }, [query]);

    const getSearchParamsMethod = useCallback((): Record<string, any> => {
        return getSearchParams();
    }, [getSearchParams]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [debounceTimer]);

    const contextValue: SearchContextValue = {
        query,
        isSearching,
        searchConfig,
        setQuery,
        clearSearch,
        performSearch,
        setSearchConfig,
        hasActiveSearch,
        getSearchParams: getSearchParamsMethod,
    };

    return (
        <SearchContext.Provider value={contextValue}>
            {children}
        </SearchContext.Provider>
    );
};

export default SearchProvider;
