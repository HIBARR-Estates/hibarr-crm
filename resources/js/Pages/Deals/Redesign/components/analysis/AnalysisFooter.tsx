import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface Props {
    filledCount: number;
    totalCount: number;
    currentStep: number;
    totalSteps: number;
    isCompleting: boolean;
    onPrev: () => void;
    onNext: () => void;
    onComplete: (completionType: "auto" | "manual", unfilledCount: number) => void;
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
    const [confirmOpen, setConfirmOpen] = useState(false);
    const unfilledCount = totalCount - filledCount;
    const allFilled = unfilledCount === 0 && totalCount > 0;
    const pct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

    const handleCompleteClick = () => {
        if (allFilled) {
            onComplete("auto", 0);
        } else {
            setConfirmOpen(true);
        }
    };

    return (
        <>
            <div
                className="flex shrink-0 items-center gap-3 px-5 py-3"
                style={{ borderTop: `1px solid ${T.BORDER}`, background: T.WHITE }}
            >
                {/* Prev */}
                <button
                    type="button"
                    className="dr-btn dr-btn-ghost"
                    disabled={currentStep === 0 || isCompleting}
                    onClick={onPrev}
                >
                    ← {td("Previous")}
                </button>

                {/* Progress bar + count (centered flex-1) */}
                <div className="flex flex-1 flex-col items-center gap-1">
                    <div
                        className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full"
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
                    <span className="text-[11px] tabular-nums" style={{ color: T.TEXT_MUTED }}>
                        <span
                            className="font-semibold"
                            style={{ color: allFilled ? T.GREEN : T.BLUE }}
                        >
                            {filledCount}
                        </span>
                        {" / "}
                        {totalCount} {td("fields")}
                    </span>
                </div>

                {/* Next */}
                <button
                    type="button"
                    className="dr-btn dr-btn-ghost"
                    disabled={currentStep === totalSteps - 1 || isCompleting}
                    onClick={onNext}
                >
                    {td("Next")} →
                </button>

                {/* Complete — far right */}
                <button
                    type="button"
                    className="dr-btn dr-btn-primary"
                    style={{
                        background: allFilled ? T.GREEN : T.BLUE,
                        opacity: isCompleting ? 0.7 : 1,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                    disabled={isCompleting}
                    onClick={handleCompleteClick}
                >
                    {isCompleting && (
                        <span
                            aria-hidden="true"
                            className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
                            style={{ width: 11, height: 11 }}
                        />
                    )}
                    ✓ {td("Mark as Complete")}
                </button>
            </div>

            <DealConfirmDialog
                open={confirmOpen}
                title={td("Complete with unfilled fields?")}
                message={
                    <>
                        <strong>{unfilledCount}</strong>{" "}
                        {td(
                            "field(s) are still empty. You can continue and fill them later, but completing now will mark this analysis as done.",
                        )}
                    </>
                }
                confirmLabel={td("Complete anyway")}
                cancelLabel={td("Go back")}
                confirmLoading={isCompleting}
                onConfirm={() => {
                    setConfirmOpen(false);
                    onComplete("manual", unfilledCount);
                }}
                onCancel={() => setConfirmOpen(false)}
            />
        </>
    );
}
