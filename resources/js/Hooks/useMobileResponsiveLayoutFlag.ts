import { usePage } from "@inertiajs/react";

export const MOBILE_RESPONSIVE_LAYOUT_FLAG = "crm.mobile-responsive-layout";

/**
 * crm.mobile-responsive-layout — gates the app-wide responsive layout pass
 * (collapsible mobile nav, responsive shell chrome, touch-friendly targets).
 * OFF = existing desktop-only rendering regardless of viewport. Globally
 * shared via Inertia's featureFlags prop (see HandleInertiaRequests).
 * Mirrors useDealExposesFlag.
 */
export default function useMobileResponsiveLayoutFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags[MOBILE_RESPONSIVE_LAYOUT_FLAG] === true;
}
