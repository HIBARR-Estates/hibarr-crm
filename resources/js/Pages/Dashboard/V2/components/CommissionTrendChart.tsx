import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Empty } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { amount } from "../format";
import type { TeamCommissionTrend } from "../types";

/**
 * The network's paid commission, month by month — a gradient area rather than
 * a bare line.
 *
 * Deliberately its own chart rather than the shared TrendLine: TrendLine draws
 * flat multi-series lines for the leadership view's company-wide movement,
 * where several series are compared against each other. This is one series
 * read for its shape — is the network's earning accelerating or stalling —
 * which is what a filled area communicates at a glance and a bare line
 * doesn't. Same visual language as the agent-facing MLM dashboard's own
 * commission trend, recharts throughout.
 */
export default function CommissionTrendChart({
    data,
    height = 260,
}: {
    data: TeamCommissionTrend;
    height?: number;
}) {
    const { td } = useTd();

    if (!data.points.length || !data.points.some((point) => point.amount > 0)) {
        return (
            <Empty
                description={td("No commission paid to the network in this window")}
            />
        );
    }

    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data.points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id="teamCommissionTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#177a5b" stopOpacity={0.32} />
                        <stop offset="95%" stopColor="#177a5b" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                    formatter={(value) => [
                        amount(Number(value ?? 0), data.currency),
                        td("Paid"),
                    ]}
                />
                <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#177a5b"
                    strokeWidth={2}
                    fill="url(#teamCommissionTrend)"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
