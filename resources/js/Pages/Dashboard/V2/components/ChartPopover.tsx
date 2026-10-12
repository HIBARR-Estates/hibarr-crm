import type { ChartTooltipContent } from "@tanstack/charts";

/**
 * Month heading + labeled series rows. The library default reads channel
 * names (`x` / `y`) and bar/area intervals, which is why the hover card
 * looked unlabeled.
 */
export default function ChartPopover({
    content,
}: {
    content: ChartTooltipContent | string;
}) {
    if (typeof content === "string") {
        return <div className="dv2-chart-popover__title">{content}</div>;
    }

    return (
        <div className="dv2-chart-popover">
            {content.title ? (
                <div className="dv2-chart-popover__title">{content.title}</div>
            ) : null}
            {content.rows.map((row) => (
                <div key={row.label} className="dv2-chart-popover__row">
                    <span
                        className="dv2-chart-popover__swatch"
                        style={
                            row.color
                                ? { background: row.color }
                                : { visibility: "hidden" }
                        }
                    />
                    <span className="dv2-chart-popover__label">{row.label}</span>
                    <span className="dv2-chart-popover__value">{row.value}</span>
                </div>
            ))}
        </div>
    );
}
