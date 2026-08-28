import React, {
    createContext,
    useContext,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@inertiajs/core";
import { useCompanyDateTimeFormatVersion } from "@/Components/CompanyDateTimeProvider";
import {
    USER_TIMEZONE_FLAG,
    getUserDateTimeContextVersion,
    setUserDateTimeContext,
    subscribeUserDateTimeContext,
} from "@/lib/userDateTime";

const UserDateTimeContext = createContext(0);

/**
 * Publishes flag-gated viewer timezone from Inertia so formatUser* and
 * useUserDateTime stay in sync with UserTimezone::forViewer().
 */
export function UserDateTimeProvider({ children }: { children: ReactNode }) {
    const { props } = usePage<PageProps>();
    useCompanyDateTimeFormatVersion();

    setUserDateTimeContext({
        enabled: props.featureFlags?.[USER_TIMEZONE_FLAG] === true,
        timezone: props.viewerTimezone || "UTC",
    });

    const version = useSyncExternalStore(
        subscribeUserDateTimeContext,
        getUserDateTimeContextVersion,
        getUserDateTimeContextVersion,
    );

    return (
        <UserDateTimeContext.Provider value={version}>
            {children}
        </UserDateTimeContext.Provider>
    );
}

export function useUserDateTimeContextVersion(): number {
    return useContext(UserDateTimeContext);
}
