import { useMemo } from "react";
import {
    barY,
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
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TeamGrowth, TeamGrowthPoint } from "../types";
import ChartPopover from "./ChartPopover";
import { labeledTooltip } from "./chartTooltip";

const JOINED_FILL = "#6dd6ac";

/**
 * Recruiting pace against the network size it produced — bars for new agents
 * that month, a line for the running total, sharing one month axis and one
 * count scale. Both series are headcounts, so a second axis would only
 * pretend they are different units.
 */
export default function NetworkGrowthChart({
    data,
    height = 260,
}: {
    data: TeamGrowth;
    height?: number;
}) {
    const { td } = useTd();
    const joinedLabel = td("New agents");
    const totalLabel = td("Network size");

    const definition = useMemo(() => {
        const rows = data.points;

        return defineChart({
            marks: [
                barY(rows, {
                    x: "label",
                    y: "joined",
                    color: () => joinedLabel,
                    fill: JOINED_FILL,
                    maxThickness: 18,
                    radius: { end: 4 },
                }),
                lineY(rows, {
                    x: "label",
                    y: "total",
                    color: () => totalLabel,
                    stroke: T.BLUE,
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
                                String(Math.round(value)),
                        },
                        tickLabels: { fontSize: 11 },
                    },
                },
            },
            color: {
                domain: [joinedLabel, totalLabel],
                range: [JOINED_FILL, T.BLUE],
                legend: colorLegend({
                    placement: "bottom",
                    items: colorLegendItems({
                        justify: "center",
                        gap: 18,
                        indicator: {
                            width: 18,
                            height: 12,
                            shape: (series) =>
                                series === joinedLabel ? "square" : "line-dot",
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
            focus: "group-x",
            tooltip: labeledTooltip<TeamGrowthPoint>((points) => {
                const row = points[0]?.datum;

                if (!row) {
                    return { rows: [] };
                }

                return {
                    title: row.label,
                    rows: [
                        {
                            label: joinedLabel,
                            value: String(row.joined),
                            color: JOINED_FILL,
                        },
                        {
                            label: totalLabel,
                            value: String(row.total),
                            color: T.BLUE,
                        },
                    ],
                };
            }),
        });
    }, [data.points, joinedLabel, totalLabel]);

    if (!data.points.length) {
        return <Empty description={td("No months in this window to plot")} />;
    }

    return (
        <Chart
            definition={definition}
            height={height}
            ariaLabel={td(
                "New agents each month against the running network size",
            )}
            style={{ width: "100%", color: T.TEXT }}
            renderTooltipBody={({ content }) => (
                <ChartPopover content={content} />
            )}
        />
    );
}
