import { router, usePage } from "@inertiajs/react";
import React, { useCallback, useState } from "react";

interface SortParams {
    sort_by?: string;
    sort_direction?: "asc" | "desc";
}

interface UsePageSortOptions {
    routeName?: string;
}

const usePageSort = ({ routeName }: UsePageSortOptions = {}) => {
    const { props, url } = usePage();
    const urlParams = new URLSearchParams(window.location.search);
    const currentSortBy = urlParams.get("sort_by") || "";
    const currentSortDirection =
        (urlParams.get("sort_direction") as "asc" | "desc") || "asc";

    const [sortParams, setSortParams] = useState<SortParams>({
        sort_by: currentSortBy,
        sort_direction: currentSortDirection,
    });

    // Handle sort change
    const handleSort = useCallback(
        (field: string) => {
            let newDirection: "asc" | "desc" = "asc";

            // If we're already sorting by this field, toggle direction
            if (currentSortBy === field) {
                newDirection = currentSortDirection === "asc" ? "desc" : "asc";
            }

            const newSortParams = {
                sort_by: field,
                sort_direction: newDirection,
            };

            setSortParams(newSortParams);

            // Get current URL params to preserve filters
            const currentParams = new URLSearchParams(window.location.search);
            const allParams: Record<string, string> = {};

            // Preserve existing params
            currentParams.forEach((value, key) => {
                if (key !== "sort_by" && key !== "sort_direction") {
                    allParams[key] = value;
                }
            });

            // Add sort params
            allParams.sort_by = field;
            allParams.sort_direction = newDirection;

            // Determine route name
            const currentRoute =
                routeName ||
                window.location.pathname.split("/").pop() ||
                "index";
            const routeNameToUse = currentRoute.includes(".")
                ? currentRoute
                : `${currentRoute}.index`;

            router.get(route(routeNameToUse), allParams, {
                preserveState: true,
                preserveScroll: true,
            });
        },
        [currentSortBy, currentSortDirection, routeName]
    );

    // Get sort state for a specific field
    const getSortState = useCallback(
        (field: string) => {
            if (currentSortBy !== field) {
                return null; // No sorting applied to this field
            }
            return currentSortDirection;
        },
        [currentSortBy, currentSortDirection]
    );

    // Check if a field is actively being sorted
    const isFieldSorted = useCallback(
        (field: string) => {
            return currentSortBy === field;
        },
        [currentSortBy]
    );

    return {
        sortParams,
        handleSort,
        getSortState,
        isFieldSorted,
        currentSortBy,
        currentSortDirection,
    };
};

export default usePageSort;
