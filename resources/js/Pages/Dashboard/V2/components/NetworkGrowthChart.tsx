import {
    Bar,
    CartesianGrid,
    ComposedChart,
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
 * Recruiting pace against the network size it produced — bars for joins,
 * a line for the running total, on the same month axis.
 *
 * A composed chart rather than the shared TrendLine's two flat lines: joins
 * and network size are different units read together (a rate and a level),
 * and a bar reads as an event on a month while a line reads as a state —
 * matching how each is actually meant.
 */
export default function NetworkGrowthChart({
    data,
    height = 240,
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
            <ComposedChart data={data.points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                    yAxisId="joined"
                    tick={{ fontSize: 11 }}
                    width={36}
                    allowDecimals={false}
                />
                <YAxis
                    yAxisId="total"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    width={36}
                    allowDecimals={false}
                />
                <Tooltip
                    formatter={(value, key) => [
                        Number(value ?? 0),
                        key === "joined" ? td("Joined") : td("Network size"),
                    ]}
                />
                <Bar
                    yAxisId="joined"
                    dataKey="joined"
                    fill="#9fe1cb"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                />
                <Line
                    yAxisId="total"
                    type="monotone"
                    dataKey="total"
                    stroke="#1a6bb5"
                    strokeWidth={2}
                    dot={false}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}
