import { useCallback, useState } from "react";
import axios from "axios";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export interface ReferralCommissionInput {
    referral_pool_rate: number | null;
    referral_fixed_amount: number | null;
}

/**
 * Saves the deal's referral percentage and agreed amount, then patches the
 * workspace deal from the response so the commission split updates in place.
 */
export default function useDealReferralCommission(dealId: number) {
    const { setDeal } = useDealWorkspace();
    const [saving, setSaving] = useState(false);

    const save = useCallback(
        async (input: ReferralCommissionInput) => {
            setSaving(true);
            try {
                const response = await axios.patch(
                    route("deals.referral_commission.update", dealId),
                    input,
                );
                if (response.data?.status === "success" && response.data?.data) {
                    setDeal(response.data.data);
                }
            } finally {
                setSaving(false);
            }
        },
        [dealId, setDeal],
    );

    return { save, saving };
}
