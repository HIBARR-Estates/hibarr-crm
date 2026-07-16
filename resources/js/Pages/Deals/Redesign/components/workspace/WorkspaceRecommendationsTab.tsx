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
    onCountChange,
}: WorkspaceRecommendationsTabProps) {
    const { td } = useTd();
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
                <DealButton variant="ghost" onClick={() => refetch()}>
                    {td("Try Again")}
                </DealButton>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-3.5 flex items-center justify-between gap-3">
                <span className="text-xs text-[#5b6472]">
                    {recommendationItems.length}{" "}
                    {recommendationItems.length === 1
                        ? td("property")
                        : td("properties")}{" "}
                    {td("recommended")}
                </span>

                <div className="flex items-center gap-2">
                    {cached && (
                        <DealBadge variant="blue">
                            <span className="inline-flex items-center gap-1">
                                <DealIcon name="info" size={11} />
                                {td("Cached")}
                            </span>
                        </DealBadge>
                    )}
                    <DealButton
                        variant="navy"
                        icon={
                            <DealIcon
                                name="refresh"
                                size={12}
                                color={T.WHITE}
                            />
                        }
                        onClick={refreshRecommendations}
                        loading={loading}
                    >
                        {td("Refresh")}
                    </DealButton>
                </div>
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
                        variant="navy"
                        icon={
                            <DealIcon
                                name="refresh"
                                size={12}
                                color={T.WHITE}
                            />
                        }
                        onClick={refreshRecommendations}
                        loading={loading}
                    >
                        {td("Generate Recommendations")}
                    </DealButton>
                </div>
            ) : (
                recommendationItems.map((item) => {
                    const metaParts = [
                        `#${item.rank}`,
                        item.typeLabel,
                        item.locationLabel,
                        item.specsLabel,
                    ].filter(Boolean);

                    return (
                        <article
                            key={item.id}
                            className="mb-2.5 rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3.5 last:mb-0"
                        >
                            <div className="mb-2 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="mb-0.5 text-sm font-semibold text-[#1a1f2e]">
                                        {item.propertyTitle}
                                    </div>
                                    <div
                                        className="text-base font-semibold"
                                        style={{ color: T.NAVY }}
                                    >
                                        {item.priceLabel}
                                    </div>
                                </div>

                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    {item.matchPercentage !== null && (
                                        <DealBadge
                                            variant={item.matchBadgeVariant}
                                        >
                                            {item.matchPercentage}% {td("match")}
                                        </DealBadge>
                                    )}
                                    {item.statusLabel && (
                                        <DealBadge
                                            variant={item.statusBadgeVariant}
                                        >
                                            {item.statusLabel}
                                        </DealBadge>
                                    )}
                                </div>
                            </div>

                            {metaParts.length > 0 && (
                                <div className="mb-2 text-[11px] capitalize text-[#9ca3af]">
                                    {metaParts.join(" · ")}
                                </div>
                            )}

                            {item.reasoningNotes && (
                                <div className="mb-2.5 text-xs italic leading-relaxed text-[#5b6472]">
                                    {item.reasoningNotes}
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
                                ) : (
                                    <DealButton
                                        variant="primary"
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
