import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
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

function urgencyLabel(
    urgency: EntitySummaryNextStep["urgency"],
    t: (key: string) => string,
): string {
    const key = `pages.entity_summary.urgency.${urgency}`;
    const translated = t(key);
    return translated === key ? urgency.replace(/_/g, " ") : translated;
}

export default function EntityAiSummaryNextStep({
    nextStep,
    onAction,
    actionable,
}: EntityAiSummaryNextStepProps) {
    const { t } = useTranslation();
    const { td } = useTd();

    if (nextStep.action_type === "NO_ACTION_NEEDED") {
        return null;
    }

    return (
        <footer className="entity-ai-summary-next-step">
            <div className="entity-ai-summary-next-step__body">
                <p className="entity-ai-summary-next-step__label">
                    {t("pages.entity_summary.suggested_next_step", {
                        urgency: urgencyLabel(nextStep.urgency, t),
                    })}
                </p>
                <p className="entity-ai-summary-next-step__text">
                    {td(nextStep.label, { source: "en" })}
                </p>
                {nextStep.rationale && (
                    <p className="entity-ai-summary-next-step__rationale">
                        {td(nextStep.rationale, { source: "en" })}
                    </p>
                )}
            </div>
            {actionable ? (
                <button
                    type="button"
                    className="entity-ai-summary-next-step__button"
                    onClick={onAction}
                >
                    {nextStepButtonLabel(nextStep, t)}
                </button>
            ) : (
                <span
                    className="entity-ai-summary-next-step__manual"
                    title={t("pages.entity_summary.manual_step_tooltip")}
                >
                    {t("pages.entity_summary.manual_step")}
                </span>
            )}
        </footer>
    );
}
