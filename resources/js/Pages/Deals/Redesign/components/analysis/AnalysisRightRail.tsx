import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { completeButtonState } from "./analysisProgress";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import AnalysisStepsPanel from "./AnalysisStepsPanel";
import AnalysisAnswersPanel from "./AnalysisAnswersPanel";
import type { RailSectionGroup } from "./analysisRailItems";

export type AnalysisRailTab = "steps" | "answers";

interface Props {
    groups: RailSectionGroup[];
    activeSection: string;
    onJump: (sectionId: string) => void;
    totalFilled: number;
    totalFields: number;
    allFilled: boolean;
    /** Required steps still unsettled — what actually gates completion. */
    requiredMissing: number;
    /** The agent has stepped through to the last section. */
    reachedEnd: boolean;
    isCompleting: boolean;
    onComplete: () => void;
    tab?: AnalysisRailTab;
    onTabChange?: (tab: AnalysisRailTab) => void;
}

/** Right column: tabbed Script steps / Captured answers, with Complete pinned below. */
export default function AnalysisRightRail({
    groups,
    activeSection,
    onJump,
    totalFilled,
    totalFields,
    allFilled,
    requiredMissing,
    reachedEnd,
    isCompleting,
    onComplete,
    tab: controlledTab,
    onTabChange,
}: Props) {
    const { td } = useTd();
    const { ready, label } = completeButtonState(
        requiredMissing,
        Math.max(0, totalFields - totalFilled),
        isCompleting,
        reachedEnd,
    );
    const [uncontrolledTab, setUncontrolledTab] = useState<AnalysisRailTab>("steps");
    const tab = controlledTab ?? uncontrolledTab;
    const setTab = (next: AnalysisRailTab) => {
        onTabChange?.(next);
        if (controlledTab === undefined) setUncontrolledTab(next);
    };

    const answeredCount = groups.reduce(
        (n, g) => n + g.steps.filter((s) => s.filled && s.value).length,
        0,
    );
    const stepsActive = tab === "steps";

    return (
        <div
            className="flex flex-col absolute inset-0"
            style={{ background: stepsActive ? T.NAVY : T.SURFACE }}
        >
            <div
                className="shrink-0 grid grid-cols-2"
                style={{
                    borderBottom: stepsActive
                        ? "1px solid rgba(255,255,255,0.08)"
                        : `1px solid ${T.BORDER}`,
                }}
            >
                <RailTab
                    active={stepsActive}
                    dark={stepsActive}
                    onClick={() => setTab("steps")}
                    label="Script steps"
                />
                <RailTab
                    active={!stepsActive}
                    dark={stepsActive}
                    onClick={() => setTab("answers")}
                    label="Captured answers"
                    badge={answeredCount > 0 ? answeredCount : undefined}
                />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
                {stepsActive ? (
                    <AnalysisStepsPanel
                        groups={groups}
                        activeSection={activeSection}
                        onJump={onJump}
                    />
                ) : (
                    <AnalysisAnswersPanel
                        groups={groups}
                        activeSection={activeSection}
                        onJump={onJump}
                    />
                )}
            </div>

            {/* Pinned so Complete stays reachable from either tab */}
            <div
                className="shrink-0 p-3"
                style={{
                    background: stepsActive ? T.NAVY : T.SURFACE,
                    borderTop: stepsActive
                        ? "1px solid rgba(255,255,255,0.08)"
                        : `1px solid ${T.BORDER}`,
                }}
            >
                <button
                    type="button"
                    disabled={isCompleting}
                    onClick={onComplete}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all disabled:cursor-wait"
                    style={{
                        cursor: "pointer",
                        // Green means "nothing required is outstanding" — optional
                        // empties are reported in the label, not the colour.
                        ...(ready
                            ? { backgroundColor: "#10b981", color: "#fff" }
                            : {
                                  backgroundColor: T.AMBER_SOFT,
                                  color: T.AMBER,
                                  border: `1px solid ${T.AMBER_MID}`,
                              }),
                    }}
                >
                    {td(ready && allFilled && !isCompleting ? "Complete Analysis ✓" : label, { source: "en" })}
                </button>
            </div>
        </div>
    );
}

function RailTab({
    active,
    dark,
    onClick,
    label,
    badge,
}: {
    active: boolean;
    dark: boolean;
    onClick: () => void;
    label: string;
    badge?: number;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="relative px-3 py-3.5 text-xs font-bold uppercase tracking-widest transition-colors"
            style={{
                color: dark
                    ? active
                        ? "#fff"
                        : "rgba(255,255,255,0.72)"
                    : active
                      ? T.TEXT
                      : T.TEXT_MUTED,
                background: dark
                    ? active
                        ? "rgba(255,255,255,0.1)"
                        : "transparent"
                    : active
                      ? T.SURFACE
                      : "transparent",
            }}
        >
            <span className="inline-flex items-center justify-center gap-1.5">
                {label}
                {badge != null ? (
                    <span
                        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[11px] font-bold tabular-nums"
                        style={{
                            background: dark
                                ? active
                                    ? "#38bdf8"
                                    : "rgba(255,255,255,0.22)"
                                : active
                                  ? T.NAVY
                                  : T.BORDER,
                            color: dark || active ? "#fff" : T.TEXT,
                        }}
                    >
                        {badge}
                    </span>
                ) : null}
            </span>
            {active ? (
                <span
                    className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full"
                    style={{ background: dark ? "#38bdf8" : T.NAVY }}
                />
            ) : null}
        </button>
    );
}
