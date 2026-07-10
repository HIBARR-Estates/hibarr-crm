import dayjs from "dayjs";
import { Deal } from "@/Types/api/deals";

function formatCurrencyValue(deal: Deal): string {
    const amount = deal.value_breakdown?.final_value ?? deal.value ?? 0;
    const symbol = deal.currency?.currency_symbol ?? "";
    return `${symbol}${Number(amount).toLocaleString()}`;
}

export default function useDealHeaderData(deal: Deal) {
    return {
        title: deal.name,
        pipelineName: deal.pipeline?.name ?? "--",
        createdAt: deal.created_at ? dayjs(deal.created_at).format("MMM DD, YYYY HH:mm") : "--",
        updatedAt: deal.updated_at ? dayjs(deal.updated_at).format("MMM DD, YYYY HH:mm") : "--",
        closeDate: deal.close_date ? dayjs(deal.close_date).format("MMM DD, YYYY") : "--",
        value: formatCurrencyValue(deal),
    };
}
