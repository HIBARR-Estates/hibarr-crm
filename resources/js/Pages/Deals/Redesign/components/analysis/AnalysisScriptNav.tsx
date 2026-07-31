import { useEffect, useRef } from "react";
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

export default function AnalysisScriptNav({
    steps,
    current,
    onSelect,
    onPrev,
    onNext,
}: Props) {
    const { td } = useTd();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;
        const active = container.querySelector<HTMLElement>('[aria-selected="true"]');
        active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }, [current]);

    const atStart = current === 0;
    const atEnd = current === steps.length - 1;

    return (
        <div
            className="flex shrink-0 items-stretch gap-0"
            style={{
                borderBottom: `1px solid ${T.BORDER}`,
                background: T.SURFACE_2,
                minHeight: 52,
            }}
        >
            {/* Previous arrow — 44px minimum touch target */}
            <button
                type="button"
                onClick={onPrev}
                disabled={atStart}
                aria-label={td("Previous step")}
                className="flex shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                style={{
                    minWidth: 44,
                    color: atStart ? T.TEXT_HINT : T.TEXT_MUTED,
                    background: "transparent",
                    fontSize: 16,
                    opacity: atStart ? 0.4 : 1,
                    cursor: atStart ? "default" : "pointer",
                }}
            >
                ←
            </button>

            {/* Scrollable step tabs */}
            <div
                ref={scrollRef}
                className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
                style={{ scrollbarWidth: "none" }}
                role="tablist"
                aria-label={td("Analysis steps")}
            >
                {steps.map((step, i) => {
                    const isActive = i === current;
                    const isDone = step.total > 0 && step.filled === step.total;
                    const pct =
                        step.total > 0
                            ? Math.round((step.filled / step.total) * 100)
                            : 0;

                    return (
                        <button
                            key={step.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-current={isActive ? "true" : undefined}
                            onClick={() => onSelect(i)}
                            className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap px-4 py-0 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                            style={{
                                borderBottom: `2px solid ${isActive ? T.BLUE : "transparent"}`,
                                color: isActive ? T.BLUE : T.TEXT_MUTED,
                                fontWeight: isActive ? 600 : 500,
                                background: isActive ? `${T.BLUE}08` : "transparent",
                            }}
                        >
                            {/* Step number / completion badge */}
                            <span
                                className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                aria-hidden="true"
                                style={{
                                    background: isActive
                                        ? T.BLUE
                                        : isDone
                                          ? T.GREEN_LIGHT
                                          : T.BORDER,
                                    color: isActive
                                        ? T.WHITE
                                        : isDone
                                          ? T.GREEN
                                          : T.TEXT_MUTED,
                                }}
                            >
                                {isDone ? "✓" : i + 1}
                            </span>

                            <span>{td(step.label)}</span>

                            {/* Completion % — supplementary, not primary indicator */}
                            {!isDone && step.total > 0 && (
                                <span
                                    className="text-[11px] tabular-nums"
                                    aria-hidden="true"
                                    style={{
                                        color: isActive ? T.BLUE_MID : T.TEXT_HINT,
                                    }}
                                >
                                    {pct}%
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Step counter */}
            <span
                className="flex shrink-0 items-center px-2 tabular-nums text-[11px]"
                aria-live="polite"
                aria-label={`${td("Step")} ${current + 1} ${td("of")} ${steps.length}`}
                style={{ color: T.TEXT_MUTED }}
            >
                {current + 1}/{steps.length}
            </span>

            {/* Next arrow */}
            <button
                type="button"
                onClick={onNext}
                disabled={atEnd}
                aria-label={td("Next step")}
                className="flex shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                style={{
                    minWidth: 44,
                    color: atEnd ? T.TEXT_HINT : T.TEXT_MUTED,
                    background: "transparent",
                    fontSize: 16,
                    opacity: atEnd ? 0.4 : 1,
                    cursor: atEnd ? "default" : "pointer",
                }}
            >
                →
            </button>
        </div>
    );
}
