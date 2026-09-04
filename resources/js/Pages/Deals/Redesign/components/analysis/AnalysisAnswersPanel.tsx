import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import type { RailSectionGroup, RailStep } from "./analysisRailItems";

interface Props {
    groups: RailSectionGroup[];
    activeSection: string;
    /** Step being asked right now — the rail mirrors the centre panel's highlight. */
    activeStepKey: string | null;
    onJump: (sectionId: string) => void;
}

/** White "Captured answers" tab — only steps that actually hold a value. */
export default function AnalysisAnswersPanel({ groups, activeSection, activeStepKey, onJump }: Props) {
    // Section name belongs on the group heading, not repeated on every card.
    const answeredGroups = groups
        .map((g) => ({ ...g, steps: g.steps.filter((s) => s.filled && s.value) }))
        .filter((g) => g.steps.length > 0);

    return (
        <div className="flex flex-col h-full min-h-0" style={{ background: T.SURFACE }}>
            <div className="flex-1 overflow-y-auto min-h-0">
                {answeredGroups.length === 0 ? (
                    <p className="px-4 py-3 text-sm" style={{ color: T.TEXT_MUTED }}>
                        Answers will appear here as you capture them.
                    </p>
                ) : (
                    answeredGroups.map((group) => (
                        <div key={group.sectionId}>
                            <button
                                type="button"
                                disabled={group.locked}
                                onClick={() => onJump(group.sectionId)}
                                className="w-full text-left px-4 pt-4 pb-2 sticky top-0 z-10 border-b"
                                style={{
                                    background: T.SURFACE,
                                    borderColor: T.BORDER,
                                    cursor: group.locked ? "not-allowed" : "pointer",
                                    opacity: group.locked ? 0.45 : 1,
                                }}
                            >
                                <span
                                    className="text-[11px] font-bold uppercase tracking-widest"
                                    style={{
                                        color: group.sectionId === activeSection ? "#0284c7" : T.TEXT_HINT,
                                    }}
                                >
                                    {group.sectionTitle}
                                </span>
                            </button>

                            {group.steps.map((step) => (
                                <AnswerCard
                                    key={step.key}
                                    step={step}
                                    locked={step.locked}
                                    isActive={step.stepKey === activeStepKey}
                                    onJump={onJump}
                                />
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function AnswerCard({
    step,
    locked,
    isActive,
    onJump,
}: {
    step: RailStep;
    locked: boolean;
    isActive: boolean;
    onJump: (sectionId: string) => void;
}) {
    return (
        <button
            type="button"
            disabled={locked}
            onClick={() => onJump(step.sectionId)}
            className="w-full text-left px-4 py-2.5 transition-colors relative border-b"
            style={{
                borderColor: T.BORDER,
                backgroundColor: isActive ? T.BLUE_LIGHT : "#ffffff",
                cursor: locked ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
                if (!isActive && !locked) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = T.SURFACE_2;
                }
            }}
            onMouseLeave={(e) => {
                if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff";
                }
            }}
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: isActive ? "#38bdf8" : "transparent" }}
            />
            {/* Question lighter than its answer — the weight difference replaces the
                labels and the box that used to separate them. */}
            <p className="text-[13px] font-normal leading-snug line-clamp-2" style={{ color: T.TEXT_MUTED }}>
                {step.title}
            </p>
            <p className="text-[14px] font-bold leading-snug break-words mt-0.5" style={{ color: T.TEXT }}>
                {step.value}
            </p>
        </button>
    );
}
