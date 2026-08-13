import axios from "axios";
import { message } from "antd";
import { useCallback, useState } from "react";
import { Deal } from "@/Types/api/deals";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export type DealOutcome = "won" | "lost" | null;

interface OutcomeResult {
    changed: boolean;
    from: string | null;
    to: string | null;
    reverted_commissions: number;
    paid_commissions_kept: number;
    commissions_queued: boolean;
}

/**
 * Manual won/lost override. Admin-only server-side.
 *
 * Deliberately not folded into useDealPipeline: changing the outcome is not a
 * field edit. Marking won queues MLM commission distribution and locks the deal;
 * un-marking it reverses the pending commissions and the agent's metrics. The
 * caller is expected to confirm before invoking this.
 */
export default function useDealOutcome(deal: Deal) {
    const [saving, setSaving] = useState(false);
    const { setDeal } = useDealWorkspace();
    // English stays the source of truth in code; translated at the point of display.
    const { td } = useTd();

    const setOutcome = useCallback(
        async (outcome: DealOutcome, reason?: string) => {
            if (saving) return null;
            setSaving(true);

            try {
                const response = await axios.patch(
                    route("deals.outcome.update", deal.id),
                    { outcome_status: outcome, reason: reason ?? null },
                    { headers: { Accept: "application/json" } },
                );

                if (response.data?.success && response.data?.data) {
                    setDeal(response.data.data);
                }

                const result: OutcomeResult | undefined = response.data?.outcome;

                // Report what actually happened rather than a generic "saved".
                // Commissions are queued, not written, so don't claim otherwise.
                if (result?.changed && result.reverted_commissions > 0) {
                    message.success(
                        `${td("Outcome updated.")} ${result.reverted_commissions} ${td("pending commission(s) reverted.")}`,
                    );
                } else if (result?.changed && result.commissions_queued) {
                    message.success(
                        td("Outcome updated. Commission distribution has been queued."),
                    );
                } else {
                    message.success(td("Outcome updated."));
                }

                if (result?.paid_commissions_kept) {
                    message.warning(
                        `${result.paid_commissions_kept} ${td("already-paid commission(s) were left untouched and must be settled manually.")}`,
                    );
                }

                return result ?? null;
            } catch (error) {
                const status = axios.isAxiosError(error)
                    ? error.response?.status
                    : undefined;

                message.error(
                    status === 403
                        ? td("Only an administrator can change a deal's outcome.")
                        : td("Could not update the outcome."),
                );

                return null;
            } finally {
                setSaving(false);
            }
        },
        [deal.id, saving, setDeal, td],
    );

    return { setOutcome, saving };
}
