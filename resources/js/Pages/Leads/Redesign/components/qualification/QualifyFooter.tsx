import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";

type QualificationFlow = ReturnType<typeof useQualificationFlow>;

interface QualifyFooterProps {
    flow: QualificationFlow;
    /** Hide nav on outcome segments — caller decides. */
    hidden?: boolean;
}

export default function QualifyFooter({ flow, hidden }: QualifyFooterProps) {
    const { td } = useTd();

    if (hidden || !flow.currentSegment) {
        return null;
    }

    const isLast = flow.isLastSegment;
    const nextDisabled =
        flow.saving || (!isLast && Boolean(flow.validationError));

    return (
        <div className="v2-modal-footer">
            <button
                type="button"
                className="v2-btn v2-btn-ghost"
                disabled={!flow.canGoBack || flow.saving}
                onClick={() => void flow.goBack()}
            >
                <Icon name="chevron-left" size={14} />
                {td("Back", { source: "en" })}
            </button>

            <span
                style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 11,
                    color: "var(--lr-text-dim)",
                }}
            >
                {td("Answers save as you go", { source: "en" })}
            </span>

            {!isLast ? (
                <button
                    type="button"
                    className="v2-btn-link"
                    disabled={flow.saving}
                    onClick={() => void flow.goNext({ skipValidation: true })}
                >
                    {td("Skip", { source: "en" })}
                </button>
            ) : null}

            <button
                type="button"
                className="v2-btn v2-btn-primary"
                disabled={nextDisabled}
                onClick={() => void flow.goNext()}
            >
                {isLast ? td("Finish", { source: "en" }) : td("Next", { source: "en" })}
                {!isLast ? <Icon name="chevron-right" size={14} /> : null}
            </button>
        </div>
    );
}
