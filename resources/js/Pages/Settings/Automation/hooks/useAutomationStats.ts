import { useEffect, useState } from "react";
import axios from "axios";
import { AutomationStatsSummary } from "../types";

/** Fetch against deal-automations.stats — company-wide (no id) for
 * Overview.tsx, or scoped to one automation for AutomationDetail.tsx. */
export default function useAutomationStats(automationId?: number) {
    const [stats, setStats] = useState<AutomationStatsSummary | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        axios
            .get(route("deal-automations.stats"), {
                headers: { Accept: "application/json" },
                params: automationId ? { automation_id: automationId } : undefined,
            })
            .then((res) => {
                if (!cancelled) setStats(res.data?.data ?? null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [automationId]);

    return { stats, loading };
}
