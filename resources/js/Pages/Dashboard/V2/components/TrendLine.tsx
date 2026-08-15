import { Empty } from "antd";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface TrendSeries {
    /** Key on each datum to plot. */
    dataKey: string;
    /** English source label — translated at render. */
    label: string;
    color: string;
}

interface TrendLineProps {
    data: Array<Record<string, string | number>>;
    series: TrendSeries[];
    /** Key holding the x-axis label on each datum. */
    xKey?: string;
    height?: number;
}

/**
 * Multi-series trend line. Deliberately period-over-period rather than
 * point-in-time — the leadership view reads movement, not current state.
 */
export default function TrendLine({
    data,
    series,
    xKey = "period",
    height = 280,
}: TrendLineProps) {
    const { td } = useTd();

    if (!data.length || !series.length) {
        return <Empty description={td("Not enough history to plot a trend")} />;
    }

    return (
        <ResponsiveContainer width="100%" height={height}>
            <LineChart
                data={data}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                {series.map((line) => (
                    <Line
                        key={line.dataKey}
                        type="monotone"
                        dataKey={line.dataKey}
                        name={td(line.label)}
                        stroke={line.color}
                        strokeWidth={2}
                        dot={false}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
}
