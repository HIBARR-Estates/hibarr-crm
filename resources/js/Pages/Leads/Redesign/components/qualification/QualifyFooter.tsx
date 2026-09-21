import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

type QualificationFlow = ReturnType<typeof useQualificationFlow>;

interface QualifyFooterProps {
    flow: QualificationFlow;
    hidden?: boolean;
    onNext?: (options?: { skipValidation?: boolean }) => void | Promise<void>;
    treatAsLast?: boolean;
    finishLabel?: string;
}

/** Step footer styled like AnalysisScrollPanel. */
export default function QualifyFooter({
    flow,
    hidden,
    onNext,
    treatAsLast,
    finishLabel,
}: QualifyFooterProps) {
    const { td } = useTd();

    if (hidden || !flow.currentSegment) {
        return null;
    }

    const isLast = treatAsLast ?? flow.isLastSegment;
    const nextDisabled = !isLast && Boolean(flow.validationError);
    const stepCount = Math.max(flow.walkSegments.length, 1);
    const stepLabel = Math.min(
        Math.max(flow.walkIndex, 0) + 1,
        stepCount,
    );

    const handleNext = (options?: { skipValidation?: boolean }) => {
        if (onNext) {
            void onNext(options);
            return;
        }
        void flow.goNext(options);
    };

    const handleBack = () => {
        if (treatAsLast != null && flow.walkIndex > 0) {
            const prev = flow.walkSegments[flow.walkIndex - 1];
            if (prev) {
                void flow.jumpToSegment(prev.key);
                return;
            }
        }
        void flow.goBack();
    };

    const canGoBack =
        treatAsLast != null ? flow.walkIndex > 0 : flow.canGoBack;

    return (
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-3 bg-white border-t border-dr-border">
            <button
                type="button"
                onClick={handleBack}
                disabled={!canGoBack}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-dr-text-muted cursor-pointer transition-colors hover:bg-dr-surface-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
                <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
                {td("Previous", { source: "en" })}
            </button>

            <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs font-medium tabular-nums text-dr-text-muted">
                    {td("Step", { source: "en" })} {stepLabel}{" "}
                    {td("of", { source: "en" })} {stepCount}
                </span>
                {!isLast ? (
                    <button
                        type="button"
                        className="text-[11px] font-medium text-dr-text-hint hover:text-dr-text-muted"
                        onClick={() => handleNext({ skipValidation: true })}
                    >
                        {td("Skip", { source: "en" })}
                    </button>
                ) : null}
            </div>

            <button
                type="button"
                onClick={() => handleNext()}
                disabled={nextDisabled}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: T.NAVY }}
            >
                {isLast
                    ? finishLabel || td("Next", { source: "en" })
                    : td("Next", { source: "en" })}
                {!isLast ? (
                    <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                ) : null}
            </button>
        </div>
    );
}
