import React, {
    createContext,
    useContext,
    useRef,
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
 *
 * Only copy Inertia → the module store when those shared props change.
 * Re-renders caused by setUserDateTimeContext (e.g. Preferences axios
 * save) must not overwrite a newer client timezone with a stale snapshot.
 */
export function UserDateTimeProvider({ children }: { children: ReactNode }) {
    const { props } = usePage<PageProps>();
    useCompanyDateTimeFormatVersion();

    const enabled = props.featureFlags?.[USER_TIMEZONE_FLAG] === true;
    const timezone = props.viewerTimezone || "UTC";
    const inertiaKey = `${enabled ? "1" : "0"}:${timezone}`;
    const lastInertiaKey = useRef<string | null>(null);
    if (lastInertiaKey.current !== inertiaKey) {
        lastInertiaKey.current = inertiaKey;
        setUserDateTimeContext({ enabled, timezone });
    }

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
