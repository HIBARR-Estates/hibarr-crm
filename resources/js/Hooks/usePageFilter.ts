import { TFilter } from "@/Types/common";
import { router, usePage } from "@inertiajs/react";
import React, { useCallback, useState } from "react";

const usePageFilter = ({ handleClose }: { handleClose: () => void }) => {
    const { props } = usePage();
    const urlFilters = props.filters;
    const [filters, setFilters] = useState<TFilter>(urlFilters);
    // Handle quick filter changes (for the filter bar)
    const handleQuickFilter = useCallback(
        (key: keyof TFilter, value: TFilter[keyof TFilter]) => {
            setFilters((prev) => {
                const updated = { ...prev } as TFilter;
                if (value === "" || value === "all") {
                    delete (updated as any)[key];
                } else {
                    if (typeof value === "string") {
                        (updated as any)[key] = value;
                    }
                }
                return updated;
            });
        },
        []
    );

    // Reset filters
    const handleResetQuickFilters = useCallback(() => {
        setFilters({});
    }, []);

    // Handle filter form submission
    const handleFilterSubmit = useCallback(
        (values: TFilter) => {
            const newFilters = { ...filters, ...values };
            // Remove empty values
            (Object.keys(newFilters) as (keyof TFilter)[]).forEach((key) => {
                if (
                    ["string", "number", "boolean"].includes(
                        typeof newFilters[key]
                    ) === false
                ) {
                    delete newFilters[key];
                }
            });

            router.get(route("properties.index"), newFilters, {
                preserveState: true,
                preserveScroll: true,
            });
            handleClose();
        },
        [filters]
    );

    // Reset filters
    const handleResetFilters = useCallback(() => {
        router.get(
            route("properties.index"),
            {},
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
        handleClose();
    }, []);

    return {
        filters,
        handleQuickFilter,
        handleResetQuickFilters,
        handleResetFilters,
        handleFilterSubmit,
    };
};

export default usePageFilter;
