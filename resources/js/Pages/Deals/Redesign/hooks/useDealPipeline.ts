import axios from "axios";
import { message } from "antd";
import { useCallback, useMemo, useState } from "react";
import { Deal } from "@/Types/api/deals";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export default function useDealPipeline(deal: Deal, canChangeStages: boolean) {
    const { t } = useTranslation();
    const [isUpdating, setIsUpdating] = useState(false);
    const { setDeal } = useDealWorkspace();

    const stages = useMemo(() => deal.pipeline?.stages ?? [], [deal.pipeline?.stages]);
    const currentStageId = deal.lead_stage?.id ?? deal.pipeline_stage_id;
    const currentPriority = deal.lead_stage?.priority ?? 0;

    const updateStage = useCallback(
        async (nextStageId: number) => {
            if (!canChangeStages || isUpdating || nextStageId === currentStageId) return;
            setIsUpdating(true);
            try {
                // deals.patch only touches fields present in the payload — unlike
                // deals.update, it won't detach packages/products on a stage-only change.
                const response = await axios.patch(
                    route("deals.patch", deal.id),
                    { pipeline_stage_id: nextStageId },
                    { headers: { Accept: "application/json" } },
                );
                if (response.data?.success && response.data?.data) {
                    setDeal(response.data.data);
                    message.success(t("pages.deals.header.pipeline.messages.stage_updated"));
                }
            } catch {
                message.error(t("pages.deals.header.pipeline.messages.update_failed"));
            } finally {
                setIsUpdating(false);
            }
        },
        [canChangeStages, currentStageId, deal.id, isUpdating, setDeal, t],
    );

    return {
        stages,
        currentStageId,
        currentPriority,
        isUpdating,
        updateStage,
    };
}
