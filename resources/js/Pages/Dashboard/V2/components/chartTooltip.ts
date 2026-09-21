import type {
    ChartPoint,
    ChartTooltipContent,
    ChartTooltipInput,
} from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";

/**
 * Portaled hover card with app-owned copy. Portal is required because
 * DashboardPanel clips overflow; without it the popover is cut off mid-card.
 */
export function labeledTooltip<TDatum>(
    content: (
        points: readonly ChartPoint<TDatum>[],
    ) => ChartTooltipContent,
): ChartTooltipInput<TDatum> {
    return {
        use: tooltip,
        className: "dv2-chart-tooltip",
        portal,
        content,
        sticky: false,
        offset: 12,
    };
}
