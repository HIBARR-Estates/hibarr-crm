import type { FieldValueMapContext } from "@/lib/customFieldValueMap";
import type { VisibilityEvaluationContext } from "@/lib/customFieldVisibility";

/**
 * The full deal context a visibility rule can read — every reserved key
 * buildFieldValueMap() understands, plus the stage list an ordering
 * `pipeline_stage` criterion resolves priorities against.
 *
 * Built in one place so every evaluator call site on the deal pages agrees:
 * a rule that hides a field in the deal view must hide the same field in the
 * analysis modal's progress count, its rail, and its forms — a call site that
 * omits, say, packageIds silently evaluates a `deal_package` rule as "no
 * match" and disagrees with the others.
 */
export interface DealVisibilityContext {
    valueMap: FieldValueMapContext;
    evaluation: VisibilityEvaluationContext;
}

export function buildDealVisibilityContext(deal: any): DealVisibilityContext {
    return {
        valueMap: {
            pipeline: deal?.lead_pipeline_id,
            pipelineStage: deal?.pipeline_stage_id,
            packageIds: (deal?.packages ?? []).map((p: any) => p?.id).filter((id: any) => id != null),
            recordId: deal?.id,
        },
        evaluation: {
            stages: deal?.pipeline?.stages ?? [],
        },
    };
}
