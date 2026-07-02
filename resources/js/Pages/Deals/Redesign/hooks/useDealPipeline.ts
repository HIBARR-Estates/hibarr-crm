import { router } from "@inertiajs/react";
import { message } from "antd";
import { useCallback, useMemo, useState } from "react";
import { Deal } from "@/Types/api/deals";

export default function useDealPipeline(deal: Deal, canChangeStages: boolean) {
    const [isUpdating, setIsUpdating] = useState(false);

    const stages = useMemo(() => deal.pipeline?.stages ?? [], [deal.pipeline?.stages]);
    const currentStageId = deal.lead_stage?.id ?? deal.pipeline_stage_id;
    const currentPriority = deal.lead_stage?.priority ?? 0;

    const updateStage = useCallback(
        (nextStageId: number) => {
            if (!canChangeStages || isUpdating || nextStageId === currentStageId) return;
            setIsUpdating(true);
            router.put(
                route("deals.update", deal.id),
                { pipeline_stage_id: nextStageId },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => message.success("Deal stage updated"),
                    onError: () => message.error("Failed to update stage"),
                    onFinish: () => setIsUpdating(false),
                },
            );
        },
        [canChangeStages, currentStageId, deal.id, isUpdating],
    );

    return {
        stages,
        currentStageId,
        currentPriority,
        isUpdating,
        updateStage,
    };
}
