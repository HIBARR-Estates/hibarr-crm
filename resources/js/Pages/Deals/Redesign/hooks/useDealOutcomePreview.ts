import { useApiQuery } from "@/lib/api/client/useApiQuery";

export interface DealOutcomePreviewLeg {
    agent_name: string;
    type: string;
    amount: number;
}

export interface DealOutcomePreview {
    currently_won: boolean;
    commission_locked?: boolean;
    pending_commissions?: {
        count: number;
        total_amount: number;
        legs: DealOutcomePreviewLeg[];
    };
    paid_commissions?: {
        count: number;
        total_amount: number;
    };
}

interface DealOutcomePreviewResponse {
    success: boolean;
    data: DealOutcomePreview;
}

/**
 * Read-only preview of what leaving 'won' would do to this deal's
 * commissions — fetched only while the outcome-change confirmation dialog is
 * open on a currently-won deal, so the dialog can show real numbers instead
 * of generic "commissions will be reverted" copy.
 */
export default function useDealOutcomePreview(dealId: number, enabled: boolean) {
    const { data, isLoading } = useApiQuery<DealOutcomePreviewResponse>({
        path: route("deals.outcome.preview", dealId),
        options: { enabled, retry: false },
    });

    return { preview: data?.data, isLoading };
}
