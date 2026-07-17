import type { EntitySummaryNextStep } from "@/Types/entity-summary";
import { nextStepButtonLabel } from "./summaryActions";

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

    const urgencyLabel = nextStep.urgency.replace(/_/g, " ");

    return (
        <footer className="entity-ai-summary-next-step">
            <div className="entity-ai-summary-next-step__body">
                <p className="entity-ai-summary-next-step__label">
                    Suggested next step · {urgencyLabel}
                </p>
                <p className="entity-ai-summary-next-step__text">{nextStep.label}</p>
                {nextStep.rationale && (
                    <p className="entity-ai-summary-next-step__rationale">
                        {nextStep.rationale}
                    </p>
                )}
            </div>
            <button
                type="button"
                className="entity-ai-summary-next-step__button"
                onClick={onAction}
            >
                {nextStepButtonLabel(nextStep)}
            </button>
        </footer>
    );
}
