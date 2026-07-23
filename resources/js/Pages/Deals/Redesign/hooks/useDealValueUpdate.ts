import axios from "axios";
import { message } from "antd";
import { useCallback, useState } from "react";
import { Deal } from "@/Types/api/deals";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

interface DealValuePayload {
    value_source?: "manual" | "calculated";
    manual_value?: number;
}

export default function useDealValueUpdate(deal: Deal, canEdit: boolean) {
    const { t } = useTranslation();
    const [isUpdating, setIsUpdating] = useState(false);
    const { setDeal } = useDealWorkspace();

    const update = useCallback(
        async (payload: DealValuePayload) => {
            if (!canEdit || isUpdating) return;
            setIsUpdating(true);
            try {
                // deals.patch accepts value_source/manual_value (PatchRequest),
                // unlike deals.update.
                const response = await axios.patch(
                    route("deals.patch", deal.id),
                    payload,
                    { headers: { Accept: "application/json" } },
                );
                if (response.data?.success && response.data?.data) {
                    setDeal(response.data.data);
                }
            } catch {
                message.error(t("pages.deals.info.value_insight.messages.update_failed"));
            } finally {
                setIsUpdating(false);
            }
        },
        [canEdit, deal.id, isUpdating, setDeal, t],
    );

    return { isUpdating, update };
}
