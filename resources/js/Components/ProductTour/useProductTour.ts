import { useCallback, useState } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";

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
        () => stepsCount > 0 && !seenTours.includes(tourId),
    );
    const [stepIndex, setStepIndex] = useState(0);

    // Fired once per completion/skip — never per step, never on restart.
    const dismiss = useCallback(() => {
        setActive(false);
        setStepIndex(0);
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
