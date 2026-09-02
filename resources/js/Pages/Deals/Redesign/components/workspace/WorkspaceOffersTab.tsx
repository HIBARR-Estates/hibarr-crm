import { useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type { Deal } from "@/Types/api/deals";
import { isDealEffectivelyLocked } from "@/lib/dealOutcome";
import {
    toWorkspaceOfferApplicationItem,
    type WorkspaceOfferApplicationItem,
} from "../../adapters/offerApplicationAdapter";
import useDealOffers from "../../hooks/useDealOffers";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface WorkspaceOffersTabProps {
    deal: Deal;
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

/** v2.2's Offers tab shows applied DealOfferApplication discounts. The tab
 * itself is hidden unless at least one property on the deal has an offer
 * applied — this component only renders in that case. */
export default function WorkspaceOffersTab({ deal }: WorkspaceOffersTabProps) {
    const { t } = useTranslation();
    const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
    const symbol = deal.currency?.currency_symbol || "£";

    const { applications, totalDiscount, isLoading, isError, refetch } =
        useDealOffers(deal.id);

    const { mutate: removeAllOffers, isPending: isRemoving } = useApiMutate<
        undefined,
        unknown,
        ApiResponse<unknown>
    >(route("deals.offers.remove", deal.id), "DELETE", () => {
        refetch();
        setConfirmRemoveAll(false);
    });

    const items = useMemo(
        () => applications.map(toWorkspaceOfferApplicationItem),
        [applications],
    );

    const isInitialLoading = isLoading && items.length === 0;

    // A failed request must read as "couldn't load", not silently render
    // nothing the way a genuinely empty (no offers applied) result does.
    if (isError && items.length === 0) {
        return (
            <div
                role="alert"
                className="rounded-[10px] border border-dashed px-3.5 py-6 text-center"
                style={{ borderColor: T.BORDER, background: T.SURFACE_2 }}
            >
                <div
                    className="mb-[3px] text-[13px] font-semibold"
                    style={{ color: T.TEXT }}
                >
                    {t("pages.deals.workspace.offers.load_failed")}
                </div>
                <DealButton
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => refetch()}
                >
                    {t("pages.deals.workspace.offers.retry")}
                </DealButton>
            </div>
        );
    }

    if (!isInitialLoading && items.length === 0) {
        return null;
    }

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
                        disabled={isDealEffectivelyLocked(deal) || isRemoving}
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
