import { useMemo } from "react";
import {
    areaY,
    colorLegend,
    colorLegendItems,
    defineChart,
    lineY,
} from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react/tooltip";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { Empty } from "antd";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import { amount } from "../format";
import type {
    TeamCommissionTrend,
    TeamCommissionTrendPoint,
} from "../types";
import ChartPopover from "./ChartPopover";
import { labeledTooltip } from "./chartTooltip";

/**
 * The network's paid commission, month by month — a filled area rather than
 * a bare line.
 *
 * Deliberately its own chart rather than the shared TrendLine: TrendLine
 * draws flat multi-series lines for the leadership view's company-wide
 * movement, where several series are compared against each other. This is
 * one series read for its shape — is the network's earning accelerating or
 * stalling — which is what a filled area communicates at a glance.
 */
export default function CommissionTrendChart({
    data,
    height = 260,
}: {
    data: TeamCommissionTrend;
    height?: number;
}) {
    const { t } = useTranslation();
    const paidLabel = t("pages.dashboard.team.charts.commission_paid");
    const currency = data.currency;

    const definition = useMemo(() => {
        const rows = data.points;

        return defineChart({
            marks: [
                areaY(rows, {
                    x: "label",
                    y: "amount",
                    color: () => paidLabel,
                    fill: T.GREEN,
                    fillOpacity: 0.32,
                }),
                lineY(rows, {
                    x: "label",
                    y: "amount",
                    color: () => paidLabel,
                    stroke: T.GREEN,
                    strokeWidth: 2.5,
                    points: true,
                }),
            ],
            scales: {
                x: {
                    scale: () => scaleBand<string>().padding(0.28),
                    axis: { tickLabels: { fontSize: 11 } },
                },
                y: {
                    scale: scaleLinear,
                    nice: true,
                    grid: { stroke: T.BORDER_SOFT, strokeDasharray: "3 3" },
                    axis: {
                        ticks: {
                            format: (value: number) =>
                                amount(value, currency),
                        },
                        tickLabels: { fontSize: 11 },
                    },
                },
            },
            color: {
                domain: [paidLabel],
                range: [T.GREEN],
                legend: colorLegend({
                    placement: "bottom",
                    items: colorLegendItems({
                        justify: "center",
                        gap: 18,
                        indicator: {
                            width: 18,
                            height: 12,
                            shape: "line-dot",
                        },
                        label: { fontSize: 12, fill: T.TEXT_MUTED },
                    }),
                }),
            },
            theme: {
                foreground: T.TEXT,
                muted: T.TEXT_HINT,
                grid: T.BORDER_SOFT,
                background: "transparent",
            },
            focus: "nearest-x",
            maxFocusDistance: Number.POSITIVE_INFINITY,
            tooltip: labeledTooltip<TeamCommissionTrendPoint>((points) => {
                const row = points[0]?.datum;

                if (!row) {
                    return { rows: [] };
                }

                return {
                    title: row.label,
                    rows: [
                        {
                            label: paidLabel,
                            value: amount(row.amount, currency),
                            color: T.GREEN,
                        },
                    ],
                };
            }),
        });
    }, [currency, data.points, paidLabel]);

    if (!data.points.length || !data.points.some((point) => point.amount > 0)) {
        return (
            <Empty
                description={t("pages.dashboard.team.charts.commission_empty")}
            />
        );
    }

    return (
        <Chart
            definition={definition}
            height={height}
            ariaLabel={t("pages.dashboard.team.charts.commission_aria")}
            style={{ width: "100%", color: T.TEXT }}
            renderTooltipBody={({ content }) => (
                <ChartPopover content={content} />
            )}
        />
    );
}
