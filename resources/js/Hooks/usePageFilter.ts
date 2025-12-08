import { TFilter } from "@/Types/common";
import { router, usePage } from "@inertiajs/react";
import React, { useCallback, useState } from "react";

interface UsePageFilterOptions {
    handleClose?: () => void;
    routeName?: string;
}

const usePageFilter = ({
    handleClose,
    routeName,
}: UsePageFilterOptions = {}) => {
    const { props } = usePage();
    const urlFilters = props.filters || {};
    const [filters, setFilters] = useState<TFilter>(urlFilters);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Open filter drawer
    const openFilterDrawer = useCallback(() => {
        setDrawerOpen(true);
    }, []);

    // Close filter drawer
    const closeFilterDrawer = useCallback(() => {
        setDrawerOpen(false);
        handleClose?.();
    }, [handleClose]);

    // Handle quick filter changes (for the filter bar)
    const handleQuickFilter = useCallback(
        (key: keyof TFilter, value: TFilter[keyof TFilter]) => {
            setFilters((prev) => {
                const updated = { ...prev } as TFilter;
                if (
                    value === "" ||
                    value === "all" ||
                    value === null ||
                    value === undefined
                ) {
                    delete (updated as any)[key];
                } else {
                    if (
                        typeof value === "string" ||
                        typeof value === "number"
                    ) {
                        (updated as any)[key] = value;
                    }
                }
                return updated;
            });
        },
        []
    );

    // Remove a specific filter
    const removeFilter = useCallback((key: keyof TFilter) => {
        setFilters((prev) => {
            const updated = { ...prev };
            delete (updated as any)[key];
            return updated;
        });
    }, []);

    // Reset filters
    const handleResetQuickFilters = useCallback(() => {
        setFilters({});
    }, []);

    // Clear all filters and navigate
    const clearAllFilters = useCallback(() => {
        const currentRoute =
            routeName || window.location.pathname.split("/").pop() || "index";
        const routeNameToUse = currentRoute.includes(".")
            ? currentRoute
            : `${currentRoute}.index`;

        router.get(
            route(routeNameToUse),
            {},
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
        setFilters({});
        handleClose?.();
    }, [routeName, handleClose]);

    // Handle filter form submission
    const handleFilterSubmit = useCallback(
        (values: TFilter) => {
            const newFilters = { ...filters, ...values };
            // Remove empty values
            (Object.keys(newFilters) as (keyof TFilter)[]).forEach((key) => {
                const value = newFilters[key];
                if (
                    value === null ||
                    value === undefined ||
                    value === "" ||
                    value === "all" ||
                    (Array.isArray(value) && value.length === 0)
                ) {
                    delete newFilters[key];
                }
            });

            const currentRoute =
                routeName ||
                window.location.pathname.split("/").pop() ||
                "index";
            const routeNameToUse = currentRoute.includes(".")
                ? currentRoute
                : `${currentRoute}.index`;

            router.get(route(routeNameToUse), newFilters, {
                preserveState: true,
                preserveScroll: true,
            });
            setFilters(newFilters);
            handleClose?.();
        },
        [filters, routeName, handleClose]
    );

    // Reset filters
    const handleResetFilters = useCallback(() => {
        const currentRoute =
            routeName || window.location.pathname.split("/").pop() || "index";
        const routeNameToUse = currentRoute.includes(".")
            ? currentRoute
            : `${currentRoute}.index`;

        router.get(
            route(routeNameToUse),
            {},
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
        setFilters({});
        handleClose?.();
    }, [routeName, handleClose]);

    return {
        filters,
        drawerOpen,
        openFilterDrawer,
        closeFilterDrawer,
        handleQuickFilter,
        removeFilter,
        handleResetQuickFilters,
        handleResetFilters,
        handleFilterSubmit,
        clearAllFilters,
    };
};

export default usePageFilter;
