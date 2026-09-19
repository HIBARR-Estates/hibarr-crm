import { useEffect, useState } from "react";
import axios from "axios";
import { AutomationStatsSummary } from "../types";
import { SHOW_FIRED_FOR } from "../config/featureToggles";

const emptyStats: AutomationStatsSummary = {
    total_runs: 0,
    success_rate: null,
    last_run_at: null,
    runs_last_7_days: [],
    fired_for: [],
    fired_for_total: 0,
};

/** Fetch against deal-automations.stats — company-wide (no id) for
 * Overview.tsx, or scoped to one automation for AutomationDetail.tsx. */
export default function useAutomationStats(automationId?: number) {
    const [stats, setStats] = useState<AutomationStatsSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        axios
            .get(route("deal-automations.stats"), {
                headers: { Accept: "application/json" },
                params: {
                    automation_id: automationId,
                    // Only the (currently hidden) Fired-for panel needs the
                    // per-record breakdown, and it costs an extra grouping
                    // query — so it's asked for, never assumed.
                    fired_for: automationId && SHOW_FIRED_FOR ? 1 : undefined,
                },
            })
            .then((res) => {
                if (!cancelled) setStats(res.data?.data ?? emptyStats);
            })
            .catch(() => {
                if (!cancelled) {
                    setStats(emptyStats);
                    setError("failed");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [automationId]);

    return { stats, loading, error };
}
