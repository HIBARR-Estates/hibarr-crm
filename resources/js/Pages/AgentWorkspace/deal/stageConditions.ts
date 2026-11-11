import { isStageRequirementMet, type StageRequirementCondition } from "@/Pages/Deals/Redesign/adapters/stageRequirementEvaluator";
import type { Deal } from "@/Types/api/deals";

export interface NextStageConditions {
    /** The stage after the current one; null on the last stage. */
    next: { id: number; name: string } | null;
    conditions: Array<{ condition: StageRequirementCondition; met: boolean }>;
    met: number;
    /** Null while the deferred requirements haven't loaded. */
    loaded: boolean;
}

/**
 * The next stage's automation requirements, each checked against the live
 * deal (the same check the stage stepper's requirements dialog makes).
 * They guide the move; they never block it.
 */
export function nextStageConditions(
    deal: Deal,
    requirements: Record<number, StageRequirementCondition[]> | undefined,
): NextStageConditions {
    const stages = [...(deal.pipeline?.stages ?? [])].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    const currentId = deal.lead_stage?.id ?? deal.pipeline_stage_id;
    const index = stages.findIndex((stage) => stage.id === currentId);
    const next = index >= 0 ? (stages[index + 1] ?? null) : null;
    const list = next ? (requirements?.[next.id] ?? []) : [];
    const conditions = list.map((condition) => ({ condition, met: isStageRequirementMet(deal, condition) }));
    return {
        next: next ? { id: next.id, name: next.name } : null,
        conditions,
        met: conditions.filter((entry) => entry.met).length,
        loaded: requirements !== undefined,
    };
}
