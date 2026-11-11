import {
    answersFromQualification,
    computeWalkSegments,
    hasAnswerContent,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import type { LeadQualification, TemplateTree } from "@/Types/qualification";
import type { KeyFactGroup } from "./model";

export interface QualificationFactLabels {
    answered: (answered: number, total: number) => string;
    next: (step: number) => string;
    complete: string;
}

/**
 * Where the lead's qualification stands as one key-facts tile (canvas L7-05's
 * Household / Finances tiles, which are answers of the script): how many
 * questions are answered and which step is next, in amber while any are still
 * open. Counted on the same walkable path as the goal panel and the qualify
 * dialog. Null when no qualification is running.
 */
export function buildQualificationFact(
    tree: TemplateTree | null | undefined,
    current: LeadQualification | null | undefined,
    labels: QualificationFactLabels,
): KeyFactGroup | null {
    if (!tree || !current) return null;
    const answers = answersFromQualification(current.answers ?? [], tree);
    const steps = computeWalkSegments(tree, answers).filter((segment) => segment.type === "question");
    if (steps.length === 0) return null;
    const answered = steps.filter((segment) => hasAnswerContent(answers[segment.key])).length;
    const next = steps.findIndex((segment) => !hasAnswerContent(answers[segment.key]));
    if (next < 0) {
        return { id: "qualification", lead: labels.answered(answered, steps.length), lines: [labels.complete] };
    }
    return {
        id: "qualification",
        lead: labels.answered(answered, steps.length),
        lines: [labels.next(next + 1)],
        empty: true,
    };
}
