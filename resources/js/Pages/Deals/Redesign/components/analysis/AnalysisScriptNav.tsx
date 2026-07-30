import { useRef } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

export interface ScriptStep {
    id: string;
    label: string;
    filled: number;
    total: number;
}

interface Props {
    steps: ScriptStep[];
    current: number;
    onSelect: (index: number) => void;
    onPrev: () => void;
    onNext: () => void;
}

export default function AnalysisScriptNav({ steps, current, onSelect, onPrev, onNext }: Props) {
    const { td } = useTd();
    const scrollRef = useRef<HTMLDivElement>(null);

    return (
        <div
            className="flex shrink-0 items-center gap-1"
            style={{
                height: 56,
                borderBottom: `1px solid ${T.BORDER}`,
                background: T.SURFACE_2,
                paddingLeft: 8,
                paddingRight: 8,
            }}
        >
            <button
                type="button"
                className="dr-btn dr-btn-ghost dr-btn-sm shrink-0"
                onClick={onPrev}
                disabled={current === 0}
                aria-label={td("Previous step")}
                style={{ minWidth: 32, padding: "5px 8px" }}
            >
                ←
            </button>

            <div
                ref={scrollRef}
                className="dr-hscroll flex flex-1 items-stretch gap-0 overflow-x-auto"
                style={{ scrollbarWidth: "none" }}
            >
                {steps.map((step, i) => {
                    const isActive = i === current;
                    const isDone = step.total > 0 && step.filled === step.total;
                    const pct = step.total > 0 ? Math.round((step.filled / step.total) * 100) : 0;

                    return (
                        <button
                            key={step.id}
                            type="button"
                            onClick={() => onSelect(i)}
                            className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2 text-[13px] font-medium transition-colors"
                            style={{
                                borderBottomColor: isActive ? T.BLUE : "transparent",
                                color: isActive ? T.BLUE : T.TEXT_MUTED,
                                fontWeight: isActive ? 600 : 500,
                                background: "transparent",
                                border: "none",
                                borderBottom: `2px solid ${isActive ? T.BLUE : "transparent"}`,
                            }}
                        >
                            <span
                                className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                style={{
                                    background: isActive ? T.BLUE : isDone ? T.GREEN_LIGHT : T.BORDER,
                                    color: isActive ? T.WHITE : isDone ? T.GREEN : T.TEXT_MUTED,
                                }}
                            >
                                {isDone ? "✓" : i + 1}
                            </span>
                            <span>{td(step.label)}</span>
                            {!isDone && step.total > 0 && (
                                <span
                                    className="text-[11px] tabular-nums"
                                    style={{ color: isActive ? T.BLUE_MID : T.TEXT_HINT }}
                                >
                                    {pct}%
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                className="dr-btn dr-btn-ghost dr-btn-sm shrink-0"
                onClick={onNext}
                disabled={current === steps.length - 1}
                aria-label={td("Next step")}
                style={{ minWidth: 32, padding: "5px 8px" }}
            >
                →
            </button>
        </div>
    );
}
