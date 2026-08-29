import { useTd } from "@/Hooks/useDynamicTranslation";
import type { UseDealAnalysisReturn } from "../../hooks/useDealAnalysis";

interface Props {
    analysis: UseDealAnalysisReturn;
    totalFilled: number;
    totalFields: number;
}

/**
 * Deal-view analysis card. Keeps one fixed footprint in every state — the card
 * never collapses to a pill on completion — and always reports field progress,
 * including when the analysis was marked complete with fields still empty.
 */
export default function AnalysisStatusBanner({ analysis, totalFilled, totalFields }: Props) {
    const { td } = useTd();

    const missing = Math.max(0, totalFields - totalFilled);
    const allFilled = totalFields > 0 && missing === 0;
    const pct = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;

    // Completed with gaps is its own state: the analysis is closed out, but the
    // record is not, and that has to stay visible.
    const completedWithGaps = analysis.isCompleted && !allFilled;

    const theme = allFilled && analysis.isCompleted
        ? {
            background: "linear-gradient(135deg, #065F46 0%, #0F9D6E 100%)",
            dot: "#6EE7B7",
            bar: "#6EE7B7",
            cta: "text-emerald-200",
            title: td("Analysis Complete", { source: "en" }),
            subtitle: td("All fields captured", { source: "en" }),
        }
        : completedWithGaps
            ? {
                background: "linear-gradient(135deg, #0A2E5D 0%, #1a4a9c 100%)",
                dot: "#FBBF24",
                bar: "#FBBF24",
                cta: "text-amber-200",
                title: td("Completed with gaps", { source: "en" }),
                subtitle: `${missing} ${missing === 1 ? td("field still empty", { source: "en" }) : td("fields still empty", { source: "en" })}`,
            }
            : {
                // Red, not navy: an unfinished analysis is the one state that needs
                // to read as outstanding work from across the deal list.
                background: "linear-gradient(135deg, #991B1B 0%, #DC2626 100%)",
                dot: "#FCA5A5",
                bar: "#FCA5A5",
                cta: "text-red-200",
                title: td("Analysis Incomplete", { source: "en" }),
                subtitle: totalFields > 0
                    ? `${missing} ${missing === 1 ? td("field left to fill", { source: "en" }) : td("fields left to fill", { source: "en" })}`
                    : td("Fill in deal info before proceeding", { source: "en" }),
            };

    const shouldPulse = !analysis.isCompleted;

    return (
        <button
            type="button"
            onClick={analysis.open}
            className={`${shouldPulse ? "analysis-banner-pulse " : ""}shrink-0 cursor-pointer text-left h-full overflow-hidden flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
            style={{
                background: theme.background,
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                width: 220,
                minWidth: 200,
            }}
        >
            {/* Title row with status dot */}
            <div className="flex items-center gap-2">
                <span
                    className={`${shouldPulse ? "analysis-dot-pulse " : ""}inline-block shrink-0 rounded-full`}
                    style={{ width: 9, height: 9, background: theme.dot }}
                    aria-hidden
                />
                <span className="text-[13px] font-semibold leading-snug text-white truncate">
                    {theme.title}
                </span>
            </div>

            {/* Progress — bar and count share one line so the card stays the same
                height as the pipeline stepper beside it. */}
            {totalFields > 0 ? (
                <div className="mt-2 flex items-center gap-2">
                    <div
                        className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
                    >
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: theme.bar }}
                        />
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-white/70">
                        {totalFilled}/{totalFields}
                    </span>
                </div>
            ) : (
                <p className="mt-2 text-[12px] leading-snug text-white/70">
                    {theme.subtitle}
                </p>
            )}

            <p className={`mt-auto pt-2 text-[12px] font-semibold ${theme.cta}`}>
                {analysis.isCompleted ? td("Review Analysis", { source: "en" }) : td("Open Analysis", { source: "en" })} →
            </p>
        </button>
    );
}
