import { useEffect, useState, type ReactNode } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface Props {
    leadName: string;
    /** Defaults to "Deal Analysis". */
    title?: string;
    isCompleted: boolean;
    totalFilled: number;
    totalFields: number;
    subscribeSaving?: (cb: (saving: boolean) => void) => () => void;
    onMinimize: () => void;
    /** Extra controls on the right (e.g. language select for qualification). */
    trailingActions?: ReactNode;
}

export default function AnalysisHeaderBar({
    leadName,
    title,
    isCompleted,
    totalFilled,
    totalFields,
    subscribeSaving,
    onMinimize,
    trailingActions,
}: Props) {
    const { td } = useTd();

    // Held here, not in the save hook — keeps save re-renders out of the modal body.
    const [isSaving, setIsSaving] = useState(false);
    useEffect(() => subscribeSaving?.(setIsSaving), [subscribeSaving]);
    const pct = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;
    const heading = title ?? td("Deal Analysis", { source: "en" });

    return (
        <div
            className="flex items-center justify-between px-5 h-14 shrink-0"
            style={{ backgroundColor: T.NAVY }}
        >
            {/* Left — icon + title + lead name + status */}
            <div className="flex items-center gap-3 min-w-0">
                <div
                    className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                >
                    <svg
                        className="w-4 h-4"
                        style={{ color: "#fff" }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                    </svg>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-white shrink-0">
                        {heading}
                    </span>
                    {leadName && (
                        <>
                            <span style={{ color: "rgba(255,255,255,0.35)" }}>·</span>
                            <span
                                className="text-sm font-medium truncate"
                                style={{ color: "rgba(255,255,255,0.7)" }}
                            >
                                {leadName}
                            </span>
                        </>
                    )}
                </div>

                <span
                    className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border"
                    style={{
                        backgroundColor: isCompleted
                            ? "rgba(16,185,129,0.2)"
                            : "rgba(255,255,255,0.1)",
                        borderColor: isCompleted
                            ? "rgba(16,185,129,0.4)"
                            : "rgba(255,255,255,0.2)",
                        color: isCompleted ? "#6ee7b7" : "rgba(255,255,255,0.75)",
                    }}
                >
                    {isCompleted ? td("Completed", { source: "en" }) : td("In Progress", { source: "en" })}
                </span>
            </div>

            {/* Right — progress + optional actions + close */}
            <div className="flex items-center gap-5 shrink-0">
                {totalFields > 0 && (
                    <div className="hidden sm:flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                            <span className="font-semibold text-white tabular-nums">{totalFilled}</span>
                            <span>/ {totalFields}</span>
                        </div>
                        <div
                            className="w-28 h-1.5 rounded-full overflow-hidden"
                            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                        >
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: pct === 100 ? "#10b981" : "#38bdf8",
                                }}
                            />
                        </div>
                        <span
                            className="text-xs font-semibold tabular-nums w-7"
                            style={{ color: pct === 100 ? "#6ee7b7" : "#38bdf8" }}
                        >
                            {pct}%
                        </span>
                    </div>
                )}

                {isSaving && (
                    <div
                        className="hidden sm:flex items-center gap-1.5"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                        aria-live="polite"
                    >
                        <svg className="w-3 h-3 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
                            <path fill="currentColor" fillOpacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-xs whitespace-nowrap">{td("Saving", { source: "en" })}&hellip;</span>
                    </div>
                )}

                {trailingActions}

                <button
                    type="button"
                    aria-label={td("Close", { source: "en" })}
                    onClick={onMinimize}
                    className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.1)";
                        (e.currentTarget as HTMLElement).style.color = "#fff";
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "";
                        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
                    }}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
