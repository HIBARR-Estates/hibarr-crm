import dayjs from "dayjs";
import { formatDate, formatDateTime } from "../adapters/dateFormat";
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
        createdAt: formatDateTime(deal.created_at),
        updatedAt: formatDateTime(deal.updated_at),
        closeDate: formatDate(deal.close_date),
        value: formatCurrencyValue(deal),
    };
}
