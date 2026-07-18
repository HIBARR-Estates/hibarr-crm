import { useEffect, useMemo } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import { toWorkspaceRecommendationListItem } from "../../adapters/recommendationAdapter";
import useDealRecommendationAdd from "../../hooks/useDealRecommendationAdd";
import useDealRecommendations from "../../hooks/useDealRecommendations";
import DealBadge from "../primitives/DealBadge";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface WorkspaceRecommendationsTabProps {
    deal: Deal;
    permissions: Record<string, string>;
    restrictPackageOrProperty?: boolean;
    onCountChange?: (count: number) => void;
}

function RecommendationSkeleton() {
    return (
        <div className="mb-2.5 animate-pulse rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3.5 last:mb-0">
            <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-[#eef1f5]" />
                    <div className="h-5 w-1/3 rounded bg-[#eef1f5]" />
                </div>
                <div className="h-6 w-16 rounded-full bg-[#eef1f5]" />
            </div>
            <div className="mb-2 h-3 w-full rounded bg-[#eef1f5]" />
            <div className="h-8 w-32 rounded bg-[#eef1f5]" />
        </div>
    );
}

export default function WorkspaceRecommendationsTab({
    deal,
    restrictPackageOrProperty = false,
    onCountChange,
}: WorkspaceRecommendationsTabProps) {
    const { td } = useTd();
    // v2.2 gate (deal-v2-2.jsx:2841): with the "1 package or property" CRM
    // config, adding is blocked once anything is already attached.
    const addBlocked =
        restrictPackageOrProperty &&
        (deal.packages?.length ?? 0) + (deal.products?.length ?? 0) > 0;
    const {
        recommendations,
        cached,
        apiError,
        isLoading,
        loading,
        refetch,
        refreshRecommendations,
    } = useDealRecommendations(deal.id);
    const {
        existingProductIds,
        addPropertiesToDeal,
        isPropertyAdding,
        isPropertyInDeal,
    } = useDealRecommendationAdd(deal);

    useEffect(() => {
        onCountChange?.(recommendations.length);
    }, [onCountChange, recommendations.length]);

    const recommendationItems = useMemo(
        () =>
            recommendations.map((recommendation) => {
                const item = toWorkspaceRecommendationListItem(recommendation, {
                    existingProductIds,
                });

                return {
                    ...item,
                    isInDeal: isPropertyInDeal(item.propertyId),
                    isAdding: isPropertyAdding(item.propertyId),
                };
            }),
        [
            recommendations,
            existingProductIds,
            isPropertyAdding,
            isPropertyInDeal,
        ],
    );

    if (isLoading) {
        return (
            <div>
                {[1, 2, 3].map((index) => (
                    <RecommendationSkeleton key={index} />
                ))}
            </div>
        );
    }

    if (apiError && recommendationItems.length === 0) {
        return (
            <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3.5 py-3.5">
                <p className="mb-1 text-sm font-medium text-[#92400e]">
                    {td(
                        "Please complete the deal information to generate property recommendations.",
                    )}
                </p>
                {apiError && (
                    <p className="mb-2 text-xs text-[#b45309]">{apiError}</p>
                )}
                <DealButton variant="ghost" size="sm" onClick={() => refetch()}>
                    {td("Try Again")}
                </DealButton>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="mb-[3px] flex items-center gap-[7px]">
                        <span
                            aria-hidden="true"
                            className="flex"
                            style={{ color: T.BLUE }}
                        >
                            <DealIcon name="spark" size={14} />
                        </span>
                        <span className="text-sm font-semibold text-[#1a1f2e]">
                            {td("Property recommendations")}
                        </span>
                        <DealBadge variant="blue">
                            {recommendationItems.length}
                        </DealBadge>
                        {cached && (
                            <DealBadge variant="gray">{td("cached")}</DealBadge>
                        )}
                    </div>
                    <div className="text-xs" style={{ color: T.TEXT_MUTED }}>
                        {td(
                            "Ranked against the deal's qualification fields — budget, interest, timeline and motivation.",
                        )}
                    </div>
                </div>
                <DealButton
                    variant="ghost"
                    size="sm"
                    icon={<DealIcon name="spark" size={12} />}
                    onClick={refreshRecommendations}
                    loading={loading}
                >
                    {td("Refresh")}
                </DealButton>
            </div>

            {apiError && (
                <div className="mb-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-xs text-[#b45309]">
                    {apiError}
                </div>
            )}

            {recommendationItems.length === 0 ? (
                <div className="px-1 py-2 text-center">
                    <div className="mb-2 flex justify-center text-[#9ca3af]">
                        <DealIcon name="building" size={28} />
                    </div>
                    <p className="mb-1 text-[13px] font-medium text-[#5b6472]">
                        {td("No recommendations yet")}
                    </p>
                    <p className="mb-3 text-xs text-[#9ca3af]">
                        {td(
                            "Recommendations are generated based on customer preferences and property matching algorithms.",
                        )}
                    </p>
                    <DealButton
                        variant="primary"
                        size="sm"
                        icon={<DealIcon name="refresh" size={12} />}
                        onClick={refreshRecommendations}
                        loading={loading}
                    >
                        {td("Generate Recommendations")}
                    </DealButton>
                </div>
            ) : (
                recommendationItems.map((item) => {
                    const metaParts = [
                        item.typeLabel,
                        item.locationLabel,
                        item.specsLabel,
                    ].filter(Boolean);

                    return (
                        <article
                            key={item.id}
                            className="dr-card last:mb-0"
                        >
                            <div className="mb-2 flex items-start justify-between gap-2.5">
                                <div className="min-w-0">
                                    <div className="mb-[3px] flex flex-wrap items-center gap-[7px]">
                                        <span
                                            className="text-[11px] font-bold"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            #{item.rank}
                                        </span>
                                        <span className="text-sm font-semibold text-[#1a1f2e]">
                                            {item.propertyTitle}
                                        </span>
                                        {item.statusLabel && (
                                            <DealBadge
                                                variant={item.statusBadgeVariant}
                                            >
                                                {item.statusLabel}
                                            </DealBadge>
                                        )}
                                    </div>
                                    <div
                                        className="text-base font-bold"
                                        style={{ color: T.NAVY }}
                                    >
                                        {item.priceLabel}
                                    </div>
                                </div>

                                {item.matchPercentage !== null && (
                                    <DealBadge
                                        className="shrink-0"
                                        variant={item.matchBadgeVariant}
                                    >
                                        {item.matchPercentage}% {td("match")}
                                    </DealBadge>
                                )}
                            </div>

                            {metaParts.length > 0 && (
                                <div
                                    className="mb-1 text-xs capitalize"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {metaParts.join(" · ")}
                                </div>
                            )}

                            {item.reasoningNotes && (
                                <div className="mb-2.5">
                                    <div className="dr-label mb-[3px]">
                                        {td("Why it matches")}
                                    </div>
                                    <div
                                        className="text-xs leading-normal"
                                        style={{ color: T.TEXT_MUTED }}
                                    >
                                        {item.reasoningNotes}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-1.5 border-t border-[#e2e5ea] pt-2">
                                {item.isInDeal ? (
                                    <DealBadge variant="green">
                                        <span className="inline-flex items-center gap-1">
                                            <DealIcon
                                                name="check"
                                                size={11}
                                            />
                                            {td("Added to Deal")}
                                        </span>
                                    </DealBadge>
                                ) : addBlocked ? (
                                    <DealButton
                                        variant="ghost"
                                        size="sm"
                                        disabled
                                        title={td(
                                            "This CRM is configured to allow only one package or property per deal",
                                        )}
                                    >
                                        {td("Add to Deal")}
                                    </DealButton>
                                ) : (
                                    <DealButton
                                        variant="primary"
                                        size="sm"
                                        onClick={() =>
                                            item.propertyId &&
                                            addPropertiesToDeal([
                                                item.propertyId,
                                            ])
                                        }
                                        loading={item.isAdding}
                                        disabled={
                                            !item.propertyId || item.isAdding
                                        }
                                    >
                                        {td("Add to Deal")}
                                    </DealButton>
                                )}

                                {item.propertyHref && (
                                    <DealButton
                                        variant="ghost"
                                        size="sm"
                                        icon={
                                            <DealIcon
                                                name="external-link"
                                                size={12}
                                            />
                                        }
                                        onClick={() =>
                                            window.open(
                                                item.propertyHref!,
                                                "_blank",
                                            )
                                        }
                                    >
                                        {td("View listing")}
                                    </DealButton>
                                )}
                            </div>
                        </article>
                    );
                })
            )}
        </div>
    );
}
