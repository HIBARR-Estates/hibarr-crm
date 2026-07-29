import React, {
    createContext,
    useContext,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@inertiajs/core";
import {
    getCompanyDateTimeFormatVersion,
    setCompanyDateTimeFormats,
    subscribeCompanyDateTimeFormats,
} from "@/lib/companyDateTime";

const CompanyDateTimeContext = createContext(0);

/**
 * Syncs company date/time formats from Inertia and exposes a version that
 * bumps when formats change so display consumers re-render.
 */
export function CompanyDateTimeProvider({ children }: { children: ReactNode }) {
    const { props } = usePage<PageProps>();
    const company = props.company;

    setCompanyDateTimeFormats({
        date_format: company?.date_format,
        // Prefer accessor (always derived from date_format); fall back to column.
        moment_date_format:
            company?.moment_date_format || company?.moment_format,
        time_format: company?.time_format,
    });

    const version = useSyncExternalStore(
        subscribeCompanyDateTimeFormats,
        getCompanyDateTimeFormatVersion,
        getCompanyDateTimeFormatVersion,
    );

    return (
        <CompanyDateTimeContext.Provider value={version}>
            {children}
        </CompanyDateTimeContext.Provider>
    );
}

/** Re-render when company date/time format settings change. */
export function useCompanyDateTimeFormatVersion(): number {
    return useContext(CompanyDateTimeContext);
}
