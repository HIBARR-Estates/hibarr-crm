import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import {
    formatMoneyAmount,
    resolveCurrencyDisplay,
    useCompanyCurrency,
} from "../../../adapters/currencyAdapter";

interface DealCardProps {
    deal: Deal;
    onClick?: () => void;
}

function StagePill({
    name,
    color,
}: {
    name: string;
    color?: string | null;
}) {
    const accent = color?.trim() || "#1a6bb5";
    return (
        <span
            className="v2-quick-stat-stage"
            style={{
                color: accent,
                background: `${accent}18`,
                borderColor: `${accent}44`,
            }}
        >
            {name}
        </span>
    );
}

export default function DealCard({ deal, onClick }: DealCardProps) {
    const { td } = useTd();
    const companyCurrency = useCompanyCurrency();

    const pipelineName = deal.pipeline?.name?.trim() || null;
    const stageName = deal.lead_stage?.name?.trim() || null;
    const stageColor = deal.lead_stage?.label_color ?? null;
    const categoryName = deal.category?.category_name?.trim() || null;
    const agentName =
        deal.lead_agent?.user?.name?.trim() ||
        deal.agent?.user?.name?.trim() ||
        null;

    const value = deal.value ?? deal.calculated_value ?? deal.manual_value;
    const valueLabel =
        value == null
            ? "—"
            : formatMoneyAmount(
                  Number(value),
                  resolveCurrencyDisplay(deal.currency, companyCurrency),
                  "symbol",
              );

    const contextParts = [pipelineName, categoryName].filter(Boolean);
    const outcome =
        deal.outcome_status === "won"
            ? td("Won", { source: "en" })
            : deal.outcome_status === "lost"
              ? td("Lost", { source: "en" })
              : null;

    return (
        <button
            type="button"
            className="v2-deal-card mb-2 w-full cursor-pointer text-left"
            onClick={onClick}
        >
            <div className="mb-1.5 flex items-start justify-between gap-3">
                <span className="min-w-0 text-[13px] font-semibold leading-snug text-[#1a1f2e]">
                    {deal.name}
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#1a6bb5]">
                    {valueLabel}
                </span>
            </div>

            {contextParts.length > 0 ? (
                <div className="mb-1.5 text-[11px] leading-snug text-[#6b7280]">
                    {contextParts.join(" · ")}
                </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-1.5">
                {stageName ? (
                    <StagePill name={stageName} color={stageColor} />
                ) : (
                    <span className="text-[11px] text-[#9ca3af]">
                        {td("No stage", { source: "en" })}
                    </span>
                )}
                {outcome ? (
                    <span
                        className={`v2-pill${
                            deal.outcome_status === "won"
                                ? " v2-pill-teal"
                                : " v2-pill-amber"
                        }`}
                    >
                        {outcome}
                    </span>
                ) : null}
                {agentName ? (
                    <span className="text-[11px] text-[#9ca3af]">
                        {agentName}
                    </span>
                ) : null}
            </div>
        </button>
    );
}
