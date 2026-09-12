import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Empty } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TeamGrowth } from "../types";

/**
 * Recruiting pace against the network size it produced — bars for new agents
 * that month, a line for the running total, sharing one month axis.
 *
 * A composed chart (recharts) rather than the shared TrendLine's two flat
 * lines: joins and network size are different units read together — one is a
 * rate, the other a level — and a bar reads as an event on a month while a
 * line reads as a running state, which is how each is actually meant. Two
 * y-axes carry that distinction through: the bar's scale (left) is never the
 * same as the line's (right), and forcing them onto one axis would flatten
 * whichever series has the smaller range.
 */
export default function NetworkGrowthChart({
    data,
    height = 260,
}: {
    data: TeamGrowth;
    height?: number;
}) {
    const { td } = useTd();

    if (!data.points.length) {
        return <Empty description={td("No months in this window to plot")} />;
    }

    return (
        <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                    yAxisId="joined"
                    tick={{ fontSize: 11 }}
                    width={34}
                    allowDecimals={false}
                />
                <YAxis
                    yAxisId="total"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    width={34}
                    allowDecimals={false}
                />
                <Tooltip
                    formatter={(value, key) => [
                        Number(value ?? 0),
                        key === "joined" ? td("New agents") : td("Network size"),
                    ]}
                />
                <Legend
                    formatter={(key) =>
                        key === "joined" ? td("New agents") : td("Network size")
                    }
                    wrapperStyle={{ fontSize: 12 }}
                />
                <Bar
                    yAxisId="joined"
                    dataKey="joined"
                    name="joined"
                    fill="#6dd6ac"
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                />
                <Line
                    yAxisId="total"
                    type="monotone"
                    dataKey="total"
                    name="total"
                    stroke="#1a6bb5"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#1a6bb5", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}
