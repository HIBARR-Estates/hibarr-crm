import type { Deal } from "@/Types/api/deals";

interface DealCardProps {
    deal: Deal;
    onClick?: () => void;
}

function formatDealValue(deal: Deal): string {
    const value = deal.value ?? deal.calculated_value ?? deal.manual_value;
    if (value == null) return "—";
    const currency = deal.currency?.currency_code ?? "";
    return currency ? `${currency} ${Number(value).toLocaleString()}` : String(value);
}

export default function DealCard({ deal, onClick }: DealCardProps) {
    const stageName = deal.lead_stage?.name ?? "No stage";

    return (
        <button
            type="button"
            className="v2-deal-card mb-2 w-full cursor-pointer text-left"
            onClick={onClick}
        >
            <div className="mb-1 flex items-start justify-between gap-2">
                <span className="text-[13px] font-semibold text-[#1a1f2e]">
                    {deal.name}
                </span>
                <span className="shrink-0 text-[13px] font-semibold text-[#1a6bb5]">
                    {formatDealValue(deal)}
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6b7280]">
                <span className="v2-pill v2-pill-blue">{stageName}</span>
                {deal.category?.category_name && (
                    <span>{deal.category.category_name}</span>
                )}
            </div>
        </button>
    );
}
