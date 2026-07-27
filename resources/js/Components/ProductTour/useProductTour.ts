import { useCallback, useState } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";

const LOCAL_SEEN_KEY_PREFIX = "product-tour-seen:";

// ponytail: the "seen" POST below is fire-and-forget, and Inertia remounts the
// page (and this hook) on every navigation — so dismissing a tour and quickly
// opening another record can outrace the write, re-showing the tour. localStorage
// is synchronous and survives the remount, so it closes that window; the server
// POST remains the cross-device source of truth.
function hasSeenLocally(tourId: string): boolean {
    try {
        return localStorage.getItem(LOCAL_SEEN_KEY_PREFIX + tourId) === "1";
    } catch {
        return false;
    }
}

function markSeenLocally(tourId: string): void {
    try {
        localStorage.setItem(LOCAL_SEEN_KEY_PREFIX + tourId, "1");
    } catch {
        // storage disabled (private browsing, quota) — server POST still fires
    }
}

/**
 * Step-index state machine for a ProductTour. Seen-state is read from the
 * `auth.user.seen_product_tours` Inertia prop (server-side, cross-device —
 * see HandleInertiaRequests::getUserWithLeadAgentId) so the tour auto-shows
 * once per user, not once per browser.
 */
export default function useProductTour(tourId: string, stepsCount: number) {
    const { props } = usePage<PageProps>();
    const seenTours = props.auth?.user?.seen_product_tours ?? [];

    const [active, setActive] = useState(
        () =>
            stepsCount > 0 &&
            !seenTours.includes(tourId) &&
            !hasSeenLocally(tourId),
    );
    const [stepIndex, setStepIndex] = useState(0);

    // Fired once per completion/skip — never per step, never on restart.
    const dismiss = useCallback(() => {
        setActive(false);
        setStepIndex(0);
        markSeenLocally(tourId);
        axios
            .post(route("product-tours.seen", tourId), null, {
                headers: { Accept: "application/json" },
            })
            .catch(() => undefined);
    }, [tourId]);

    const restart = useCallback(() => {
        setStepIndex(0);
        setActive(true);
    }, []);

    const next = useCallback(() => {
        setStepIndex((i) => {
            if (i + 1 >= stepsCount) {
                dismiss();
                return i;
            }
            return i + 1;
        });
    }, [stepsCount, dismiss]);

    const prev = useCallback(() => {
        setStepIndex((i) => Math.max(0, i - 1));
    }, []);

    return { active, stepIndex, next, prev, skip: dismiss, restart };
}
