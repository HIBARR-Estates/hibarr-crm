import type { EntitySummaryNextStep } from "@/Types/entity-summary";

interface EntityAiSummaryNextStepProps {
    nextStep: EntitySummaryNextStep;
    onAction: () => void;
}

export default function EntityAiSummaryNextStep({
    nextStep,
    onAction,
}: EntityAiSummaryNextStepProps) {
    if (nextStep.action_type === "NO_ACTION_NEEDED") {
        return null;
    }

    return (
        <footer className="entity-ai-summary-next-step">
            <div>
                <p className="entity-ai-summary-next-step__label">Suggested next step</p>
                <p className="entity-ai-summary-next-step__text">
                    {nextStep.label}
                    {nextStep.rationale ? ` — ${nextStep.rationale}` : ""}
                </p>
            </div>
            <button
                type="button"
                className="entity-ai-summary-next-step__button"
                onClick={onAction}
            >
                {nextStep.action_type === "OPEN_DEAL"
                    ? "Open deal"
                    : nextStep.action_type === "REVIEW_DEALS"
                      ? "Review deals"
                      : nextStep.label}
            </button>
        </footer>
    );
}
