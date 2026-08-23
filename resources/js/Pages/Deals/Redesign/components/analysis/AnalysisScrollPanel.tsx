import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import AnalysisSectionBlock from "./AnalysisSectionBlock";
import type { AnalysisSection } from "./types/analysisTypes";

export interface ScrollPanelHandle {
    scrollToSection: (id: string) => void;
}

interface Props {
    sections: AnalysisSection[];
    fields: any[];
    localDealFieldValues: Record<string, any>;
    canEdit: boolean;
    numberByKey?: Record<string, number>;
    totalFilled: number;
    totalFields: number;
    currentStep: number;
    stepCount: number;
    onPrevStep: () => void;
    onNextStep: () => void;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => void;
    onFieldChange?: (fieldId: number, value: any) => void;
    onActiveSectionChange: (id: string) => void;
}

const AnalysisScrollPanel = forwardRef<ScrollPanelHandle, Props>((props, ref) => {
    const {
        sections,
        fields,
        localDealFieldValues,
        canEdit,
        numberByKey,
        totalFilled,
        totalFields,
        currentStep,
        stepCount,
        onPrevStep,
        onNextStep,
        onFieldUpdate,
        onFieldChange,
        onActiveSectionChange,
    } = props;

    const { td } = useTd();

    const containerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useImperativeHandle(ref, () => ({
        scrollToSection: (id: string) => {
            const el = sectionRefs.current[id];
            if (el && containerRef.current) {
                containerRef.current.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
            }
        },
    }));

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute("data-section-id");
                        if (id) onActiveSectionChange(id);
                    }
                }
            },
            { root: container, rootMargin: "-20% 0px -60% 0px", threshold: 0 },
        );

        sections.forEach((s) => {
            const el = sectionRefs.current[s.id];
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [sections, onActiveSectionChange]);

    const progressPct = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;

    if (sections.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
                <p className="text-sm">{td("No analysis steps configured.", { source: "en" })}</p>
                <p className="text-xs italic">{td("Add steps in pipeline settings to get started.", { source: "en" })}</p>
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

            <div className="px-6 pt-5 pb-16">
                {sections.map((section) => (
                    <AnalysisSectionBlock
                        key={section.id}
                        ref={(el) => { sectionRefs.current[section.id] = el; }}
                        section={section}
                        fields={fields}
                        localDealFieldValues={localDealFieldValues}
                        canEdit={canEdit}
                        numberByKey={numberByKey}
                        onFieldUpdate={onFieldUpdate}
                        onFieldChange={onFieldChange}
                    />
                ))}
            </div>
        </div>

        {/* Step footer — the only way to reach a section that isn't revealed yet */}
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
                {td("Previous", { source: "en" })}
            </button>

            <span className="text-xs font-medium tabular-nums text-slate-500">
                {td("Section", { source: "en" })} {Math.min(currentStep + 1, stepCount)} {td("of", { source: "en" })} {stepCount}
            </span>

            <button
                type="button"
                onClick={onNextStep}
                disabled={isLast}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#0A2E5D" }}
            >
                {td("Next", { source: "en" })}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
        </>
    );
});

AnalysisScrollPanel.displayName = "AnalysisScrollPanel";
export default AnalysisScrollPanel;
