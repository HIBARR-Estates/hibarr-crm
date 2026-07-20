import type { EntitySummaryNextStep } from "@/Types/entity-summary";
import { nextStepButtonLabel } from "./summaryActions";

interface EntityAiSummaryNextStepProps {
    nextStep: EntitySummaryNextStep;
    onAction: () => void;
    /** Whether this action maps to a real in-app action (see isExecutableAction).
     * When false, the suggestion is shown as advice with no clickable button —
     * so the card never pretends a click does something the CRM can't. */
    actionable: boolean;
}

export default function EntityAiSummaryNextStep({
    nextStep,
    onAction,
    actionable,
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
            {actionable ? (
                <button
                    type="button"
                    className="entity-ai-summary-next-step__button"
                    onClick={onAction}
                >
                    {nextStepButtonLabel(nextStep)}
                </button>
            ) : (
                <span
                    className="entity-ai-summary-next-step__manual"
                    title="This is a manual step — there's no in-app action for it."
                >
                    Manual step
                </span>
            )}
        </footer>
    );
}
