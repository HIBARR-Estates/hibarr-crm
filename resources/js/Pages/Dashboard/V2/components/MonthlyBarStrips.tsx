import { useMemo } from "react";
import { barY, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react/tooltip";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import ChartPopover from "./ChartPopover";
import { labeledTooltip } from "./chartTooltip";

interface StripPoint {
    label: string;
    value: number;
}

export interface MonthlyStrip {
    key: string;
    /** Already translated. */
    label: string;
    color: string;
    points: StripPoint[];
    /** Axis and tooltip formatting — money for a currency series. */
    format: (value: number) => string;
}

/**
 * Month-by-month bars, one strip per series, each on its own scale.
 *
 * Separate strips rather than one chart because the series cannot share a
 * scale honestly: deal value in different currencies must never be read
 * against each other (exchange rates are not maintained), and commission is a
 * fraction of revenue. The months line up, so movement still reads down the
 * stack.
 */
export default function MonthlyBarStrips({
    strips,
    emptyMessage,
    height = 120,
}: {
    strips: MonthlyStrip[];
    /** Already translated. */
    emptyMessage: string;
    height?: number;
}) {
    const visible = strips.filter((strip) =>
        strip.points.some((point) => point.value > 0),
    );

    if (!visible.length) {
        return (
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                {emptyMessage}
            </p>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {visible.map((strip) => (
                <Strip key={strip.key} strip={strip} height={height} />
            ))}
        </div>
    );
}

function Strip({ strip, height }: { strip: MonthlyStrip; height: number }) {
    const { label, color, points, format } = strip;

    const definition = useMemo(
        () =>
            defineChart({
                marks: [
                    barY(points, {
                        x: "label",
                        y: "value",
                        fill: color,
                        maxThickness: 22,
                        radius: { end: 3 },
                    }),
                ],
                scales: {
                    x: {
                        scale: () => scaleBand<string>().padding(0.3),
                        axis: { tickLabels: { fontSize: 11 } },
                    },
                    y: {
                        scale: scaleLinear,
                        nice: true,
                        grid: { stroke: T.BORDER_SOFT, strokeDasharray: "3 3" },
                        axis: {
                            ticks: { count: 3, format },
                            tickLabels: { fontSize: 11 },
                        },
                    },
                },
                theme: {
                    foreground: T.TEXT,
                    muted: T.TEXT_HINT,
                    grid: T.BORDER_SOFT,
                    background: "transparent",
                },
                focus: "group-x",
                tooltip: labeledTooltip<StripPoint>((hovered) => {
                    const row = hovered[0]?.datum;

                    return row
                        ? {
                              title: row.label,
                              rows: [{ label, value: format(row.value), color }],
                          }
                        : { rows: [] };
                }),
            }),
        [points, label, color, format],
    );

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 13,
                    fontWeight: 500,
                    color: T.TEXT_MUTED,
                    marginBottom: 4,
                }}
            >
                <span
                    aria-hidden
                    style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: color,
                    }}
                />
                {label}
            </div>
            <Chart
                definition={definition}
                height={height}
                ariaLabel={label}
                style={{ width: "100%", color: T.TEXT }}
                renderTooltipBody={({ content }) => (
                    <ChartPopover content={content} />
                )}
            />
        </div>
    );
}
