import { useEffect, useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { Deal } from "@/Types/api/deals";
import { toWorkspaceRecommendationListItem } from "../../adapters/recommendationAdapter";
import useDealRecommendationAdd from "../../hooks/useDealRecommendationAdd";
import useDealRecommendations from "../../hooks/useDealRecommendations";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

interface WorkspaceRecommendationsTabProps {
    deal: Deal;
    permissions: Record<string, string>;
    restrictPackageOrProperty?: boolean;
    onCountChange?: (count: number) => void;
}

function RecommendationSkeleton() {
    return (
        <div className="mb-2.5 animate-pulse rounded-lg border border-dr-border bg-white px-3.5 py-3.5 last:mb-0">
            <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-dr-skeleton" />
                    <div className="h-5 w-1/3 rounded bg-dr-skeleton" />
                </div>
                <div className="h-6 w-16 rounded-full bg-dr-skeleton" />
            </div>
            <div className="mb-2 h-3 w-full rounded bg-dr-skeleton" />
            <div className="h-8 w-32 rounded bg-dr-skeleton" />
        </div>
    );
}

export default function WorkspaceRecommendationsTab({
    deal,
    restrictPackageOrProperty = false,
    onCountChange,
}: WorkspaceRecommendationsTabProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { default_currency_symbol: currencySymbol = "" } = usePage()
        .props as any;
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
        existingPropertyIds,
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
                    existingPropertyIds,
                    currencySymbol,
                });

                return {
                    ...item,
                    isInDeal: isPropertyInDeal(item.propertyId),
                    isAdding: isPropertyAdding(item.propertyId),
                };
            }),
        [
            recommendations,
            existingPropertyIds,
            isPropertyAdding,
            isPropertyInDeal,
            currencySymbol,
        ],
    );

    if (isLoading && recommendations.length === 0) {
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
            <div className="rounded-lg border border-dr-amber-border bg-dr-amber-bg px-3.5 py-3.5">
                <p className="mb-1 text-sm font-medium text-dr-amber">
                    {t("pages.deals.workspace.recommendations.incomplete_hint")}
                </p>
                {apiError && (
                    <p className="mb-2 text-xs text-dr-amber-text">{td(apiError)}</p>
                )}
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                    {t("pages.deals.workspace.recommendations.try_again")}
                </Button>
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
                            <Icon name="spark" size={14} />
                        </span>
                        <span className="text-sm font-semibold text-dr-text">
                            {t("pages.deals.workspace.recommendations.title")}
                        </span>
                        <Badge variant="blue">
                            {recommendationItems.length}
                        </Badge>
                        {cached && (
                            <Badge variant="gray">
                                {t("pages.deals.workspace.recommendations.cached_tag")}
                            </Badge>
                        )}
                    </div>
                    <div className="text-xs" style={{ color: T.TEXT_MUTED }}>
                        {t("pages.deals.workspace.recommendations.hint")}
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    icon={<Icon name="spark" size={12} />}
                    onClick={refreshRecommendations}
                    loading={loading}
                >
                    {t("pages.deals.common.refresh")}
                </Button>
            </div>

            {apiError && (
                <div className="mb-3 rounded-lg border border-dr-amber-border bg-dr-amber-bg px-3 py-2.5 text-xs text-dr-amber-text">
                    {apiError}
                </div>
            )}

            {recommendationItems.length === 0 ? (
                <div className="px-1 py-2 text-center">
                    <div className="mb-2 flex justify-center text-dr-text-hint">
                        <Icon name="building" size={28} />
                    </div>
                    <p className="mb-1 text-[13px] font-medium text-dr-text-muted">
                        {t("pages.deals.workspace.recommendations.empty")}
                    </p>
                    <p className="mb-3 text-xs text-dr-text-hint">
                        {t("pages.deals.workspace.recommendations.empty_hint")}
                    </p>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={<Icon name="refresh" size={12} />}
                        onClick={refreshRecommendations}
                        loading={loading}
                    >
                        {t("pages.deals.workspace.recommendations.generate")}
                    </Button>
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
                                            className="text-[12px] font-bold"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            #{item.rank}
                                        </span>
                                        <span className="text-sm font-semibold text-dr-text">
                                            {item.propertyTitle}
                                        </span>
                                        {item.statusLabel && (
                                            <Badge
                                                variant={item.statusBadgeVariant}
                                            >
                                                {td(item.statusLabel, { source: "en" })}
                                            </Badge>
                                        )}
                                    </div>
                                    <div
                                        className="text-base font-bold"
                                        style={{ color: T.NAVY }}
                                    >
                                        {item.priceLabel === "N/A"
                                            ? t("pages.deals.common.not_available")
                                            : item.priceLabel}
                                    </div>
                                </div>

                                {item.matchPercentage !== null && (
                                    <Badge
                                        className="shrink-0"
                                        variant={item.matchBadgeVariant}
                                    >
                                        {item.matchPercentage}%{" "}
                                        {t("pages.deals.workspace.recommendations.match_suffix")}
                                    </Badge>
                                )}
                            </div>

                            {metaParts.length > 0 && (
                                <div
                                    className="mb-1 text-xs capitalize"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {metaParts
                                        .map((part) => td(part ?? "", { source: "en" }))
                                        .join(" · ")}
                                </div>
                            )}

                            {item.reasoningNotes && (
                                <div className="mb-2.5">
                                    <div className="dr-label mb-[3px]">
                                        {t("pages.deals.workspace.recommendations.why_matches")}
                                    </div>
                                    <div
                                        className="text-xs leading-normal"
                                        style={{ color: T.TEXT_MUTED }}
                                    >
                                        {item.reasoningNotes}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-1.5 border-t border-dr-border pt-2">
                                {item.isInDeal ? (
                                    <Badge variant="green">
                                        <span className="inline-flex items-center gap-1">
                                            <Icon
                                                name="check"
                                                size={11}
                                            />
                                            {t("pages.deals.workspace.recommendations.added_to_deal")}
                                        </span>
                                    </Badge>
                                ) : addBlocked ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled
                                        title={t(
                                            "pages.deals.workspace.recommendations.add_blocked_hint",
                                        )}
                                    >
                                        {t("pages.deals.workspace.recommendations.add_to_deal")}
                                    </Button>
                                ) : (
                                    <Button
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
                                        {t("pages.deals.workspace.recommendations.add_to_deal")}
                                    </Button>
                                )}

                                {item.propertyHref && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={
                                            <Icon
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
                                        {t("pages.deals.workspace.recommendations.view_listing")}
                                    </Button>
                                )}
                            </div>
                        </article>
                    );
                })
            )}
        </div>
    );
}
