import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
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
            className="analysis-banner-pulse shrink-0 cursor-pointer rounded-[10px] border bg-white text-left transition-colors"
            style={{
                borderColor: T.NAVY,
                padding: "10px 14px",
                width: 220,
                outline: "none",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = T.BLUE;
                (e.currentTarget as HTMLButtonElement).style.background = T.BLUE_LIGHT;
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = T.NAVY;
                (e.currentTarget as HTMLButtonElement).style.background = T.WHITE;
            }}
        >
            {/* Title row with pulsing dot */}
            <div className="flex items-center gap-2">
                <span
                    className="analysis-dot-pulse inline-block shrink-0 rounded-full"
                    style={{ width: 9, height: 9, background: T.NAVY }}
                    aria-hidden
                />
                <span
                    className="text-[13px] font-semibold leading-snug"
                    style={{ color: T.TEXT }}
                >
                    {td("Analysis Incomplete")}
                </span>
            </div>

            {/* Subtitle */}
            <p
                className="mt-1 text-[12px] leading-snug"
                style={{ color: T.TEXT_MUTED }}
            >
                {td("Fill in deal info before proceeding")}
            </p>

            {/* CTA affordance */}
            <p
                className="mt-2 text-[12px] font-semibold"
                style={{ color: T.BLUE }}
            >
                {td("Open Analysis")} →
            </p>
        </button>
    );
}
