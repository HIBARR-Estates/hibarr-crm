import { useCallback, useState } from "react";
import axios from "axios";
import { App, message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export interface ReferralCommissionInput {
    referral_pool_rate: number | null;
    referral_fixed_amount: number | null;
}

/**
 * Saves the deal's referral percentage and agreed amount, then patches the
 * workspace deal's commission summary from the response so the split updates in
 * place. Only value_breakdown is taken from the response: replacing the whole
 * deal would let a slow referral save overwrite a newer edit to the deal's value.
 */
export default function useDealReferralCommission(dealId: number) {
    const { setDeal } = useDealWorkspace();
    const { t } = useTranslation();
    const { message: appMessage } = App.useApp();
    const toast = appMessage ?? message;
    const [saving, setSaving] = useState(false);

    const save = useCallback(
        async (input: ReferralCommissionInput) => {
            setSaving(true);
            try {
                const response = await axios.patch(
                    route("deals.referral_commission.update", dealId),
                    input,
                );
                const breakdown = response.data?.data?.value_breakdown;
                if (response.data?.status === "success" && breakdown) {
                    setDeal((prev) => ({ ...prev, value_breakdown: breakdown }));
                }
            } catch (error) {
                const serverMessage = axios.isAxiosError(error)
                    ? error.response?.data?.message
                    : null;
                toast.error(
                    typeof serverMessage === "string" && serverMessage !== ""
                        ? serverMessage
                        : t("pages.deals.info.value_insight.referral_save_failed"),
                );
            } finally {
                setSaving(false);
            }
        },
        [dealId, setDeal, t, toast],
    );

    return { save, saving };
}
