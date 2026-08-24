import { useEffect, useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useApiMutate, useApiQuery } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type { Deal } from "@/Types/api/deals";
import type { DealOfferApplication } from "@/Types/api/offers";
import { isDealEffectivelyLocked } from "@/lib/dealOutcome";
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

/** Mirrors the real table's column shapes so the loading state doesn't jump
 * around once data arrives — header stays real/translated, only the
 * data-dependent rows are skeletons. */
function OffersSkeleton({
    columnLabels,
    loadingAria,
}: {
    columnLabels: { offer: string; property: string; type: string; original: string; discount: string };
    loadingAria: string;
}) {
    return (
        <div
            role="status"
            aria-label={loadingAria}
            className="mb-2.5 overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white"
        >
            <table className="dr-table">
                <thead>
                    <tr>
                        <th scope="col">{columnLabels.offer}</th>
                        <th scope="col">{columnLabels.property}</th>
                        <th scope="col">{columnLabels.type}</th>
                        <th scope="col" style={{ textAlign: "right" }}>
                            {columnLabels.original}
                        </th>
                        <th scope="col" style={{ textAlign: "right" }}>
                            {columnLabels.discount}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {[1, 2, 3].map((row) => (
                        <tr key={row}>
                            <td>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="dr-skeleton h-4 w-4 shrink-0 rounded-full" />
                                    <span className="dr-skeleton h-3.5 w-24" />
                                </span>
                            </td>
                            <td>
                                <span className="dr-skeleton inline-block h-3.5 w-20" />
                            </td>
                            <td>
                                <span className="dr-skeleton inline-block h-5 w-16 rounded-full" />
                            </td>
                            <td style={{ textAlign: "right" }}>
                                <span className="dr-skeleton ml-auto inline-block h-3.5 w-14" />
                            </td>
                            <td style={{ textAlign: "right" }}>
                                <span className="dr-skeleton ml-auto inline-block h-3.5 w-14" />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** v2.2's Offers tab shows applied DealOfferApplication discounts, ported from
 * deal-v2-2.jsx:2739 — a distinct entity from the legacy Proposal workflow
 * this tab used to render. Data/mutation follow the existing legacy
 * implementation (resources/js/Features/Deals/DealOffersTab.tsx). */
export default function WorkspaceOffersTab({
    deal,
    onCountChange,
}: WorkspaceOffersTabProps) {
    const { t } = useTranslation();
    const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
    const symbol = deal.currency?.currency_symbol || "£";

    const { data, isLoading, refetch } = useApiQuery<DealOffersResponse>({
        path: route("deals.offers.index", deal.id),
        // Keep results fresh for 30s so flipping between tabs doesn't refire
        // the request every time the tab remounts.
        options: { staleTime: 30_000 },
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

    const isInitialLoading = isLoading && items.length === 0;

    return (
        <div>
            <div className="mb-3.5 flex items-center justify-between gap-3">
                <div>
                    <div className="text-[13px] font-semibold text-[#1a1f2e]">
                        {t("pages.deals.workspace.offers.applied_title")}
                    </div>
                    <div className="text-xs text-[#5b6472]">
                        {t("pages.deals.workspace.offers.applied_hint")}
                    </div>
                </div>
                {items.length > 0 && (
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ color: T.RED, background: T.WHITE, border: `1px solid ${T.BORDER}` }}
                        disabled={isDealEffectivelyLocked(deal)}
                        onClick={() => setConfirmRemoveAll(true)}
                    >
                        {t("pages.deals.workspace.offers.remove_all")}
                    </button>
                )}
            </div>

            {isInitialLoading ? (
                <OffersSkeleton
                    loadingAria={t("pages.deals.workspace.offers.loading_aria")}
                    columnLabels={{
                        offer: t("pages.deals.workspace.offers.col_offer"),
                        property: t("pages.deals.workspace.offers.col_property"),
                        type: t("pages.deals.workspace.offers.col_type"),
                        original: t("pages.deals.workspace.offers.col_original"),
                        discount: t("pages.deals.workspace.offers.col_discount"),
                    }}
                />
            ) : items.length === 0 ? (
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
                        {t("pages.deals.workspace.offers.empty")}
                    </div>
                    <div className="text-xs leading-relaxed text-[#5b6472]">
                        {t("pages.deals.workspace.offers.empty_hint")}
                    </div>
                </div>
            ) : (
                <>
                    <div className="mb-2.5 overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
                        <table className="dr-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t("pages.deals.workspace.offers.col_offer")}</th>
                                    <th scope="col">{t("pages.deals.workspace.offers.col_property")}</th>
                                    <th scope="col">{t("pages.deals.workspace.offers.col_type")}</th>
                                    <th scope="col" style={{ textAlign: "right" }}>
                                        {t("pages.deals.workspace.offers.col_original")}
                                    </th>
                                    <th scope="col" style={{ textAlign: "right" }}>
                                        {t("pages.deals.workspace.offers.col_discount")}
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
                            {t("pages.deals.workspace.offers.total_discount")}
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
                title={t("pages.deals.workspace.offers.remove_all_confirm_title")}
                message={t("pages.deals.workspace.offers.remove_all_confirm_message")}
                confirmLabel={t("pages.deals.workspace.offers.remove_all")}
                danger
                onConfirm={() => removeAllOffers(undefined)}
                onCancel={() => setConfirmRemoveAll(false)}
            />
        </div>
    );
}
