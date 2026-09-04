import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import AnalysisStepStream from "./AnalysisStepStream";
import { completeButtonState } from "./analysisProgress";
import type { AnalysisFlatStep } from "./analysisProgress";
import type { AnalysisSection } from "./types/analysisTypes";

export interface ScrollPanelHandle {
    scrollToSection: (id: string) => void;
}

interface Props {
    sections: AnalysisSection[];
    /** Only the steps revealed so far; the last one is the current step. */
    visibleSteps: AnalysisFlatStep[];
    /** Key of the step being asked right now. */
    currentKey: string | null;
    localDealFieldValues: Record<string, any>;
    canEdit: boolean;
    sectionProgress?: Record<string, { filled: number; total: number }>;
    totalFilled: number;
    totalFields: number;
    /** 0-based index of the current step in the full step list. */
    currentStep: number;
    stepCount: number;
    onPrevStep: () => void;
    onNextStep: () => void;
    /** Last step swaps Next for Complete — same action as the right rail's button. */
    onComplete: () => void;
    /** Required steps still unsettled — what actually gates completion. */
    requiredMissing: number;
    isCompleting: boolean;
    totalMissing: number;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => void;
    onFieldChange?: (fieldId: number, value: any) => void;
    /** Required-step resolution — see AnalysisStepStream. */
    unanswered: Record<string, unknown>;
    filledSteps: ReadonlySet<string>;
    answeredQuestions: ReadonlySet<string>;
    onToggleUnanswered: (stepKey: string, on: boolean) => void;
    onQuestionAnswered: (stepKey: string) => void;
    onQuestionCleared: (stepKey: string) => void;
}

/** Breathing room under the current step, and between it and the sticky header. */
const STEP_GAP = 16;

const AnalysisScrollPanel = forwardRef<ScrollPanelHandle, Props>((props, ref) => {
    const {
        sections,
        visibleSteps,
        currentKey,
        localDealFieldValues,
        canEdit,
        sectionProgress,
        totalFilled,
        totalFields,
        currentStep,
        stepCount,
        onPrevStep,
        onNextStep,
        onComplete,
        requiredMissing,
        isCompleting,
        totalMissing,
        onFieldUpdate,
        onFieldChange,
        unanswered,
        filledSteps,
        answeredQuestions,
        onToggleUnanswered,
        onQuestionAnswered,
        onQuestionCleared,
    } = props;

    const { td } = useTd();
    const { ready, label } = completeButtonState(requiredMissing, totalMissing, isCompleting);

    const containerRef = useRef<HTMLDivElement>(null);
    const stickyRef = useRef<HTMLDivElement>(null);
    /** Filler under the last step so it can be scrolled all the way to the top —
     *  which is what keeps the current question the only thing in view. */
    const [spacer, setSpacer] = useState(0);
    /** Last step actually scrolled to — the scroll is a step transition, not
     *  something to redo every time the step's own height changes. */
    const scrolledToRef = useRef<string | null>(null);

    /** The block to pin to the top: the current step, preceded by its section
     *  heading when the step opens a new section. */
    const measure = useCallback(() => {
        const container = containerRef.current;
        if (!container || !currentKey) return null;
        const step = container.querySelector<HTMLElement>(
            `[data-step-key="${CSS.escape(currentKey)}"]`,
        );
        if (!step) return null;

        const previous = step.previousElementSibling as HTMLElement | null;
        const anchor =
            previous && previous.hasAttribute("data-section-id") ? previous : step;

        const containerTop = container.getBoundingClientRect().top;
        const top = anchor.getBoundingClientRect().top - containerTop + container.scrollTop;
        const bottom = step.getBoundingClientRect().bottom - containerTop + container.scrollTop;
        const stickyHeight = stickyRef.current?.offsetHeight ?? 0;

        return { top, height: bottom - top, stickyHeight };
    }, [currentKey]);

    const resize = useCallback(() => {
        const container = containerRef.current;
        const m = measure();
        if (!container || !m) return;
        const available = container.clientHeight - m.stickyHeight;
        setSpacer(Math.max(0, available - m.height - STEP_GAP * 2));
    }, [measure]);

    // The spacer has to be in place before the scroll, or the container cannot
    // scroll far enough to bring the current step to the top.
    useLayoutEffect(resize, [resize, visibleSteps.length]);

    // A step can grow after it renders — a select opening, an answer box being
    // typed into — and the filler under it has to keep pace.
    useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        if (currentKey) {
            const step = container.querySelector<HTMLElement>(
                `[data-step-key="${CSS.escape(currentKey)}"]`,
            );
            if (step) observer.observe(step);
        }
        return () => observer.disconnect();
    }, [resize, currentKey]);

    // Bring the current step to the top of the view. Everything already asked stays
    // mounted above it, reachable only by scrolling back up.
    useEffect(() => {
        if (scrolledToRef.current === currentKey) return;
        const container = containerRef.current;
        const m = measure();
        if (!container || !m) return;
        container.scrollTo({
            top: Math.max(0, m.top - m.stickyHeight - STEP_GAP),
            // The opening position is not a transition — only later steps animate.
            behavior: scrolledToRef.current === null ? "auto" : "smooth",
        });
        scrolledToRef.current = currentKey;
    }, [measure, spacer, currentKey]);

    useImperativeHandle(ref, () => ({
        scrollToSection: (id: string) => {
            const container = containerRef.current;
            const el = container?.querySelector<HTMLElement>(
                `[data-section-id="${CSS.escape(id)}"]`,
            );
            if (!container || !el) return;
            const top =
                el.getBoundingClientRect().top -
                container.getBoundingClientRect().top +
                container.scrollTop;
            const stickyHeight = stickyRef.current?.offsetHeight ?? 0;
            container.scrollTo({
                top: Math.max(0, top - stickyHeight - STEP_GAP),
                behavior: "smooth",
            });
        },
    }));

    const progressPct = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;

    const currentSectionTitle = useMemo(() => {
        const step = visibleSteps[visibleSteps.length - 1];
        return sections.find((s) => s.id === step?.sectionId)?.title ?? "";
    }, [sections, visibleSteps]);

    if (stepCount === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
                <p className="text-sm">{"No analysis steps configured."}</p>
                <p className="text-xs italic">{"Add steps in pipeline settings to get started."}</p>
            </div>
        );
    }

    const isFirst = currentStep <= 0;
    const isLast = currentStep >= stepCount - 1;

    return (
        <>
        <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto bg-slate-50">
            {/* Sticky progress bar */}
            <div
                ref={stickyRef}
                className="sticky top-0 z-10 px-6 pt-4 pb-3 bg-slate-50/95 backdrop-blur-sm"
                style={{ borderBottom: "1px solid #e2e8f0" }}
            >
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Analysis Progress
                    </span>
                    <span className="text-xs tabular-nums text-slate-500">
                        <span className="font-semibold text-slate-800">{totalFilled}</span>
                        {" of "}
                        {totalFields} fields
                    </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                            width: `${progressPct}%`,
                            backgroundColor: progressPct === 100 ? "#10b981" : "#38bdf8",
                        }}
                    />
                </div>
            </div>

            <div className="px-6 pt-5">
                <AnalysisStepStream
                    sections={sections}
                    steps={visibleSteps}
                    currentKey={currentKey}
                    values={localDealFieldValues}
                    canEdit={canEdit}
                    sectionProgress={sectionProgress}
                    onFieldUpdate={onFieldUpdate}
                    onFieldChange={onFieldChange}
                    unanswered={unanswered}
                    filledSteps={filledSteps}
                    answeredQuestions={answeredQuestions}
                    onToggleUnanswered={onToggleUnanswered}
                    onQuestionAnswered={onQuestionAnswered}
                    onQuestionCleared={onQuestionCleared}
                />
                {/* Nothing sits under the current step but empty room */}
                <div aria-hidden style={{ height: spacer }} />
            </div>
        </div>

        {/* Step footer — the only way to reach a step that is not revealed yet */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-3 bg-white border-t border-slate-200">
            <button
                type="button"
                onClick={onPrevStep}
                disabled={isFirst}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-600 cursor-pointer transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {"Previous"}
            </button>

            <span className="min-w-0 truncate text-xs font-medium text-slate-500">
                <span className="tabular-nums">
                    {"Step"} {Math.min(currentStep + 1, stepCount)} {"of"} {stepCount}
                </span>
                {currentSectionTitle && (
                    <span className="text-slate-400">{` · ${currentSectionTitle}`}</span>
                )}
            </span>

            {isLast ? (
                <button
                    type="button"
                    onClick={onComplete}
                    disabled={isCompleting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90 disabled:cursor-wait"
                    // Amber until every required step is settled; the gate would
                    // refuse the click anyway, so it must not look ready.
                    style={{ backgroundColor: ready ? "#10b981" : "#d97706" }}
                >
                    {td(label, { source: "en" })}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </button>
            ) : (
                <button
                    type="button"
                    onClick={onNextStep}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "#0A2E5D" }}
                >
                    {"Next"}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}
        </div>
        </>
    );
});

AnalysisScrollPanel.displayName = "AnalysisScrollPanel";
export default AnalysisScrollPanel;
