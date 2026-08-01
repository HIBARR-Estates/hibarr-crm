import { useTd } from "@/Hooks/useDynamicTranslation";
import type { UseDealAnalysisReturn } from "../../hooks/useDealAnalysis";

interface Props {
    analysis: UseDealAnalysisReturn;
}

export default function AnalysisStatusBanner({ analysis }: Props) {
    const { td } = useTd();

    if (analysis.isCompleted) {
        return (
            <span className="dr-pill dr-pill-green self-center whitespace-nowrap">
                ✓ {td("Analysis complete")}
            </span>
        );
    }

    return (
        <button
            type="button"
            onClick={analysis.open}
            className="analysis-banner-pulse shrink-0 cursor-pointer text-left h-full flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{
                background: "linear-gradient(135deg, #0A2E5D 0%, #1a4a9c 100%)",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                width: 220,
                minWidth: 200,
            }}
        >
            {/* Title row with pulsing dot */}
            <div className="flex items-center gap-2">
                <span
                    className="analysis-dot-pulse inline-block shrink-0 rounded-full"
                    style={{ width: 9, height: 9, background: "#38BDF8" }}
                    aria-hidden
                />
                <span className="text-[13px] font-semibold leading-snug text-white">
                    {td("Analysis Incomplete")}
                </span>
            </div>

            {/* Subtitle */}
            <p className="mt-1.5 text-[12px] leading-snug text-white/70">
                {td("Fill in deal info before proceeding")}
            </p>

            {/* CTA affordance */}
            <p className="mt-auto pt-3 text-[12px] font-semibold text-sky-300">
                {td("Open Analysis")} →
            </p>
        </button>
    );
}
