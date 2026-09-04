import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import type { RailSectionGroup, RailStep } from "./analysisRailItems";

interface Props {
    groups: RailSectionGroup[];
    activeSection: string;
    /** Step being asked right now — the rail mirrors the centre panel's highlight. */
    activeStepKey: string | null;
    onJump: (sectionId: string) => void;
}

/** Navy "Script steps" tab — every step, grouped under its section. */
export default function AnalysisStepsPanel({ groups, activeSection, activeStepKey, onJump }: Props) {
    return (
        <div className="flex flex-col h-full min-h-0" style={{ background: T.NAVY }}>
            <div className="flex-1 overflow-y-auto min-h-0">
                {groups.length === 0 ? (
                    <p className="px-4 py-3 text-sm italic" style={{ color: "rgba(255,255,255,0.7)" }}>
                        No steps configured.
                    </p>
                ) : (
                    groups.map((group) => (
                        <div key={group.sectionId}>
                            <button
                                type="button"
                                disabled={group.locked}
                                onClick={() => onJump(group.sectionId)}
                                className="w-full text-left px-4 pt-4 pb-2 sticky top-0 z-10"
                                style={{
                                    background: T.NAVY,
                                    cursor: group.locked ? "not-allowed" : "pointer",
                                    opacity: group.locked ? 0.45 : 1,
                                }}
                            >
                                <span
                                    className="text-[11px] font-bold uppercase tracking-widest"
                                    style={{
                                        color:
                                            group.sectionId === activeSection
                                                ? "#7dd3fc"
                                                : "rgba(255,255,255,0.72)",
                                    }}
                                >
                                    {group.sectionTitle}
                                    {group.locked ? " · Locked" : ""}
                                </span>
                            </button>

                            {group.steps.length === 0 ? (
                                <p
                                    className="px-4 pb-3 text-[13px] italic"
                                    style={{ color: "rgba(255,255,255,0.5)" }}
                                >
                                    No steps in this section.
                                </p>
                            ) : (
                                group.steps.map((step) => (
                                    <StepItem
                                        key={step.key}
                                        step={step}
                                        isActive={step.stepKey === activeStepKey}
                                        locked={step.locked}
                                        onJump={onJump}
                                    />
                                ))
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function StepItem({
    step,
    isActive,
    locked,
    onJump,
}: {
    step: RailStep;
    isActive: boolean;
    locked: boolean;
    onJump: (sectionId: string) => void;
}) {
    return (
        <button
            type="button"
            disabled={locked}
            onClick={() => onJump(step.sectionId)}
            className="w-full text-left py-2 pl-4 pr-3 transition-colors relative"
            style={{
                backgroundColor: isActive ? "rgba(56, 189, 248, 0.16)" : "transparent",
                cursor: locked ? "not-allowed" : "pointer",
                opacity: locked ? 0.45 : 1,
            }}
            onMouseEnter={(e) => {
                if (!isActive && !locked) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)";
                }
            }}
            onMouseLeave={(e) => {
                if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = isActive
                        ? "rgba(56, 189, 248, 0.16)"
                        : "transparent";
                }
            }}
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1 transition-all"
                style={{ backgroundColor: isActive ? "#38bdf8" : "transparent" }}
            />
            {/* The question reads as context for its answer, so it stays lighter than
                the value; the ✓ carries the answered state the old eyebrow spelled out. */}
            <div
                className="text-[13px] font-normal leading-snug line-clamp-2"
                style={{ color: "rgba(255,255,255,0.72)" }}
            >
                {step.filled ? "✓ " : ""}
                {step.title}
            </div>
            {step.filled && step.value ? (
                <div className="text-[14px] font-bold leading-snug line-clamp-3 mt-0.5" style={{ color: "#ffffff" }}>
                    {step.value}
                </div>
            ) : null}
        </button>
    );
}
