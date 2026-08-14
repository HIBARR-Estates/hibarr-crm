import { useState } from "react";
import type { Segment, SegmentAnswerState } from "@/Types/qualification";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { hasAnswerContent } from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";
import QualifySegmentNavigator from "./QualifySegmentNavigator";
import QualifyAnswersPanel from "./QualifyAnswersPanel";

export type QualifyRightRailTab = "steps" | "answers";

interface QualifyRightRailProps {
    segments: Segment[];
    answers: Record<string, SegmentAnswerState>;
    currentSegmentKey?: string;
    onJump: (segmentKey: string) => void;
    /** Resolves `{{tokens}}` the same way the script body does. */
    translateScript: (text: string) => string;
    /** Controlled tab — when set with onTabChange, parent owns the selection. */
    tab?: QualifyRightRailTab;
    onTabChange?: (tab: QualifyRightRailTab) => void;
}

/** Right column: tabbed Script steps / Captured answers so each gets full height. */
export default function QualifyRightRail({
    segments,
    answers,
    currentSegmentKey,
    onJump,
    translateScript,
    tab: controlledTab,
    onTabChange,
}: QualifyRightRailProps) {
    const { td } = useTd();
    const [uncontrolledTab, setUncontrolledTab] =
        useState<QualifyRightRailTab>("steps");
    const tab = controlledTab ?? uncontrolledTab;
    const setTab = (next: QualifyRightRailTab) => {
        onTabChange?.(next);
        if (controlledTab === undefined) {
            setUncontrolledTab(next);
        }
    };

    const answeredCount = segments.filter(
        (segment) =>
            segment.type === "question" &&
            hasAnswerContent(answers[segment.key]),
    ).length;

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
                    label={td("Script steps", { source: "en" })}
                />
                <RailTab
                    active={!stepsActive}
                    dark={stepsActive}
                    onClick={() => setTab("answers")}
                    label={td("Captured answers", { source: "en" })}
                    badge={answeredCount > 0 ? answeredCount : undefined}
                />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
                {stepsActive ? (
                    <QualifySegmentNavigator
                        segments={segments}
                        answers={answers}
                        currentSegmentKey={currentSegmentKey}
                        onJump={onJump}
                        translateScript={translateScript}
                        hideHeading
                    />
                ) : (
                    <QualifyAnswersPanel
                        segments={segments}
                        answers={answers}
                        currentSegmentKey={currentSegmentKey}
                        onJump={onJump}
                        translateScript={translateScript}
                        hideHeading
                    />
                )}
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
                    style={{
                        background: dark ? "#38bdf8" : T.NAVY,
                    }}
                />
            ) : null}
        </button>
    );
}
