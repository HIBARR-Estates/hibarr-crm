import { useEffect, useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useApiMutate, useApiQuery } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type { Deal } from "@/Types/api/deals";
import type { DealOfferApplication } from "@/Types/api/offers";
import {
    toWorkspaceOfferApplicationItem,
    type WorkspaceOfferApplicationItem,
} from "../../adapters/offerApplicationAdapter";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface WorkspaceOffersTabProps {
    deal: Deal;
    onCountChange?: (count: number) => void;
}

interface DealOffersResponse {
    status: string;
    applications: DealOfferApplication[];
    total_discount: number;
}

function formatMoney(amount: number, symbol: string) {
    return `${symbol}${Number(amount).toLocaleString("en-GB")}`;
}

/** v2.2's Offers tab shows applied DealOfferApplication discounts, ported from
 * deal-v2-2.jsx:2739 — a distinct entity from the legacy Proposal workflow
 * this tab used to render. Data/mutation follow the existing legacy
 * implementation (resources/js/Features/Deals/DealOffersTab.tsx). */
export default function WorkspaceOffersTab({
    deal,
    onCountChange,
}: WorkspaceOffersTabProps) {
    const { td } = useTd();
    const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
    const symbol = deal.currency?.currency_symbol || "£";

    const { data, isLoading, refetch } = useApiQuery<DealOffersResponse>({
        path: route("deals.offers.index", deal.id),
    });

    const { mutate: removeAllOffers, isPending: isRemoving } = useApiMutate<
        undefined,
        unknown,
        ApiResponse<unknown>
    >(route("deals.offers.remove", deal.id), "DELETE", () => {
        refetch();
        setConfirmRemoveAll(false);
    });

    const items = useMemo(
        () => (data?.applications ?? []).map(toWorkspaceOfferApplicationItem),
        [data?.applications],
    );
    const totalDiscount = data?.total_discount ?? 0;

    useEffect(() => {
        onCountChange?.(items.length);
    }, [items.length, onCountChange]);

    if (isLoading) {
        return <div className="dr-skeleton h-24 w-full" />;
    }

    return (
        <div>
            <div className="mb-3.5 flex items-center justify-between gap-3">
                <div>
                    <div className="text-[13px] font-semibold text-[#1a1f2e]">
                        {td("Applied offers")}
                    </div>
                    <div className="text-xs text-[#5b6472]">
                        {td(
                            "Offers apply automatically from projects and unit types — they reduce the calculated deal value.",
                        )}
                    </div>
                </div>
                {items.length > 0 && (
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ color: T.RED, background: T.WHITE, border: `1px solid ${T.BORDER}` }}
                        disabled={deal.is_locked}
                        onClick={() => setConfirmRemoveAll(true)}
                    >
                        {td("Remove all")}
                    </button>
                )}
            </div>

            {items.length === 0 ? (
                <div
                    role="status"
                    className="rounded-[10px] border border-dashed px-3.5 py-6 text-center"
                    style={{ borderColor: T.BORDER, background: T.SURFACE_2 }}
                >
                    <div
                        aria-hidden="true"
                        className="mx-auto mb-2 flex h-[38px] w-[38px] items-center justify-center rounded-full"
                        style={{ background: T.GREEN_LIGHT }}
                    >
                        <DealIcon name="award" size={17} color={T.GREEN} />
                    </div>
                    <div className="mb-[3px] text-[13px] font-semibold text-[#1a1f2e]">
                        {td("No offers applied")}
                    </div>
                    <div className="text-xs leading-relaxed text-[#5b6472]">
                        {td(
                            "Eligible offers apply when properties with active promotions are added to the deal.",
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="mb-2.5 overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
                        <table className="dr-table">
                            <thead>
                                <tr>
                                    <th scope="col">{td("Offer")}</th>
                                    <th scope="col">{td("Property")}</th>
                                    <th scope="col">{td("Type")}</th>
                                    <th scope="col" style={{ textAlign: "right" }}>
                                        {td("Original")}
                                    </th>
                                    <th scope="col" style={{ textAlign: "right" }}>
                                        {td("Discount")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item: WorkspaceOfferApplicationItem) => (
                                    <tr key={item.id}>
                                        <td>
                                            <span className="inline-flex items-center gap-1.5 font-semibold text-[#1a1f2e]">
                                                <DealIcon
                                                    name="award"
                                                    size={13}
                                                    color={T.GREEN}
                                                />
                                                {item.offerName}
                                            </span>
                                        </td>
                                        <td style={{ color: T.TEXT_MUTED }}>
                                            {item.propertyLabel}
                                        </td>
                                        <td>
                                            <span className="dr-pill dr-pill-green">
                                                {item.offerValueLabel}
                                            </span>
                                        </td>
                                        <td
                                            style={{
                                                textAlign: "right",
                                                color: T.TEXT_MUTED,
                                            }}
                                        >
                                            {formatMoney(item.originalAmount, symbol)}
                                        </td>
                                        <td
                                            style={{
                                                textAlign: "right",
                                                fontWeight: 700,
                                                color: T.GREEN,
                                            }}
                                        >
                                            −{formatMoney(item.discountAmount, symbol)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-baseline justify-end gap-2">
                        <span className="text-xs text-[#5b6472]">
                            {td("Total discount")}
                        </span>
                        <span
                            className="text-base font-bold"
                            style={{ color: T.GREEN }}
                        >
                            −{formatMoney(totalDiscount, symbol)}
                        </span>
                    </div>
                </>
            )}

            <DealConfirmDialog
                open={confirmRemoveAll}
                title={td("Remove all offers?")}
                message={td(
                    "All applied discounts will be removed and the calculated deal value will increase accordingly.",
                )}
                confirmLabel={td("Remove all")}
                danger
                onConfirm={() => removeAllOffers(undefined)}
                onCancel={() => setConfirmRemoveAll(false)}
            />
        </div>
    );
}
