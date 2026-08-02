import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
        flow.saving ||
        (!isLast && Boolean(flow.validationError));

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: 12,
                width: "100%",
            }}
        >
            <div style={{ justifySelf: "start" }}>
                <button
                    type="button"
                    className="v2-btn v2-btn-ghost"
                    disabled={!flow.canGoBack || flow.saving}
                    onClick={() => void flow.goBack()}
                >
                    ← {td("Back")}
                </button>
            </div>

            <span
                style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                }}
            >
                {td("Answers save as you go")}
            </span>

            <div
                style={{
                    justifySelf: "end",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                }}
            >
                {!isLast && (
                    <button
                        type="button"
                        className="v2-btn v2-btn-link"
                        disabled={flow.saving}
                        onClick={() =>
                            void flow.goNext({ skipValidation: true })
                        }
                    >
                        {td("Skip")}
                    </button>
                )}
                <button
                    type="button"
                    className="v2-btn v2-btn-primary"
                    disabled={nextDisabled}
                    onClick={() => void flow.goNext()}
                >
                    {isLast ? td("Finish") : `${td("Next")} →`}
                </button>
            </div>
        </div>
    );
}
