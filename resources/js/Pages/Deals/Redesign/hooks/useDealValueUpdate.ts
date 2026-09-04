import axios from "axios";
import { message } from "antd";
import { useCallback, useState } from "react";
import { Deal } from "@/Types/api/deals";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export interface DealValuePayload {
    value_source?: "manual" | "calculated";
    manual_value?: number;
    currency_id?: number | null;
    exchange_rate?: number | null;
    discount_type?: "percent" | "fixed" | null;
    discount_value?: number | null;
    deduction_amount?: number | null;
    deduction_note?: string | null;
}

export default function useDealValueUpdate(deal: Deal, canEdit: boolean) {
    const { t } = useTranslation();
    const [isUpdating, setIsUpdating] = useState(false);
    const { setDeal } = useDealWorkspace();

    /** Resolves true when the deal was saved, so callers can close on success only. */
    const update = useCallback(
        async (payload: DealValuePayload): Promise<boolean> => {
            if (!canEdit || isUpdating) return false;
            setIsUpdating(true);
            try {
                // deals.patch accepts the value fields (PatchRequest),
                // unlike deals.update.
                const response = await axios.patch(
                    route("deals.patch", deal.id),
                    payload,
                    { headers: { Accept: "application/json" } },
                );
                if (response.data?.success && response.data?.data) {
                    setDeal(response.data.data);
                    return true;
                }
                return false;
            } catch {
                message.error(t("pages.deals.info.value_insight.messages.update_failed"));
                return false;
            } finally {
                setIsUpdating(false);
            }
        },
        [canEdit, deal.id, isUpdating, setDeal, t],
    );

    return { isUpdating, update };
}
