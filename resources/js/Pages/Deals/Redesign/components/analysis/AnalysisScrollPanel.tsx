import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
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
    updatingField?: string | null;
    totalFilled: number;
    totalFields: number;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => Promise<void>;
    onFieldChange?: (fieldId: number, value: any) => void;
    onActiveSectionChange: (id: string) => void;
}

const AnalysisScrollPanel = forwardRef<ScrollPanelHandle, Props>((props, ref) => {
    const {
        sections,
        fields,
        localDealFieldValues,
        canEdit,
        updatingField,
        totalFilled,
        totalFields,
        onFieldUpdate,
        onFieldChange,
        onActiveSectionChange,
    } = props;

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
            <div
                className="flex flex-1 flex-col items-center justify-center gap-2"
                style={{ color: T.TEXT_HINT }}
            >
                <p className="text-sm">No analysis steps configured.</p>
                <p className="text-xs italic">Add steps in pipeline settings to get started.</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="flex-1 overflow-y-auto" style={{ background: T.BG }}>
            {/* Sticky progress bar */}
            <div
                className="sticky top-0 z-10 px-6 pt-4 pb-3"
                style={{
                    borderBottom: `1px solid ${T.BORDER}`,
                    background: T.BG,
                    backdropFilter: "blur(4px)",
                }}
            >
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.TEXT_MUTED }}>
                        Analysis Progress
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: T.TEXT_MUTED }}>
                        <span className="font-semibold" style={{ color: T.TEXT }}>{totalFilled}</span>
                        {" of "}
                        {totalFields} fields
                    </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: T.BORDER }}>
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
                        updatingField={updatingField}
                        onFieldUpdate={onFieldUpdate}
                        onFieldChange={onFieldChange}
                    />
                ))}
            </div>
        </div>
    );
});

AnalysisScrollPanel.displayName = "AnalysisScrollPanel";
export default AnalysisScrollPanel;
