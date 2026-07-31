import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface Props {
    filledCount: number;
    totalCount: number;
    currentStep: number;
    totalSteps: number;
    isCompleting: boolean;
    onPrev: () => void;
    onNext: () => void;
    onComplete: () => void;
}

export default function AnalysisFooter({
    filledCount,
    totalCount,
    currentStep,
    totalSteps,
    isCompleting,
    onPrev,
    onNext,
    onComplete,
}: Props) {
    const { td } = useTd();

    const pct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
    const allFilled = totalCount > 0 && filledCount === totalCount;
    const isLastStep = currentStep === totalSteps - 1;
    const isFirstStep = currentStep === 0;

    return (
        <div
            className="flex shrink-0 items-center gap-2 px-5 py-3"
            style={{ borderTop: `1px solid ${T.BORDER}`, background: T.WHITE }}
        >
            {/* Previous */}
            <button
                type="button"
                className="dr-btn dr-btn-ghost"
                disabled={isFirstStep || isCompleting}
                onClick={onPrev}
            >
                ← {td("Prev")}
            </button>

            {/* Progress — centred */}
            <div
                className="flex flex-1 flex-col items-center gap-1"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={td("Analysis completion")}
            >
                <div
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: T.BORDER }}
                >
                    <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                            width: `${pct}%`,
                            background: allFilled ? T.GREEN : T.BLUE,
                        }}
                    />
                </div>
                <span
                    className="text-[11px] tabular-nums"
                    style={{ color: T.TEXT_MUTED }}
                >
                    <span
                        className="font-semibold"
                        style={{ color: allFilled ? T.GREEN : T.TEXT_MUTED }}
                    >
                        {filledCount}
                    </span>
                    {" / "}
                    {totalCount} {td("fields")}
                </span>
            </div>

            {/* Next — primary CTA on non-final steps */}
            {!isLastStep && (
                <button
                    type="button"
                    className="dr-btn dr-btn-primary"
                    disabled={isCompleting}
                    onClick={onNext}
                >
                    {td("Next")} →
                </button>
            )}

            {/* Complete */}
            <button
                type="button"
                className={isLastStep ? "dr-btn dr-btn-primary" : "dr-btn dr-btn-ghost dr-btn-sm"}
                style={{
                    background: isLastStep
                        ? allFilled
                            ? T.GREEN
                            : T.BLUE
                        : undefined,
                    opacity: isCompleting ? 0.7 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                }}
                disabled={isCompleting}
                onClick={onComplete}
            >
                {isCompleting && (
                    <span
                        aria-hidden="true"
                        className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
                        style={{ width: 11, height: 11 }}
                    />
                )}
                ✓ {td("Complete")}
            </button>
        </div>
    );
}
