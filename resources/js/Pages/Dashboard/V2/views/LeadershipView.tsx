import { Col, Row, Statistic, Table, Tooltip } from "antd";
import { Deferred } from "@inertiajs/react";
import DashboardPanel, { PanelSkeleton } from "../components/DashboardPanel";
import TrendLine from "../components/TrendLine";
import SourceBreakdown, {
    SourceBreakdownRow,
} from "../components/SourceBreakdown";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface LeadershipViewProps {
    trend?: Array<{ period: string; leads: number; won: number }>;
    marketSegments?: Array<{ segment: string; count: number }>;
    pipelineValue?: Array<{
        currency: string;
        total: number;
        deal_count: number;
    }>;
    sourceBreakdown?: SourceBreakdownRow[];
}

/**
 * Trend and comparison, company-level only — no individual agent names appear on
 * this view by design.
 */
export default function LeadershipView({
    trend,
    marketSegments,
    pipelineValue,
    sourceBreakdown,
}: LeadershipViewProps) {
    const { td } = useTd();

    const segmentTotal = (marketSegments ?? []).reduce(
        (sum, row) => sum + row.count,
        0,
    );

    return (
        <Row gutter={[16, 16]}>
            <Col xs={24}>
                <DashboardPanel title="Month over month">
                    <Deferred data="trend" fallback={<PanelSkeleton rows={8} />}>
                        <TrendLine
                            data={trend ?? []}
                            series={[
                                {
                                    dataKey: "leads",
                                    label: "Leads created",
                                    color: "#0ea5e9",
                                },
                                {
                                    dataKey: "won",
                                    label: "Deals won",
                                    color: "#16a34a",
                                },
                            ]}
                        />
                    </Deferred>
                </DashboardPanel>
            </Col>

            <Col xs={24} lg={10}>
                <DashboardPanel
                    title="Open pipeline value"
                    note="Shown per currency — exchange rates are not maintained, so these must not be summed"
                >
                    <Deferred
                        data="pipelineValue"
                        fallback={<PanelSkeleton rows={3} />}
                    >
                        <Row gutter={[16, 16]}>
                            {(pipelineValue ?? []).map((row) => (
                                <Col span={12} key={row.currency}>
                                    <Statistic
                                        title={
                                            <Tooltip
                                                title={`${row.deal_count} ${td("open deals")}`}
                                            >
                                                <span>
                                                    {row.currency.toUpperCase()}
                                                </span>
                                            </Tooltip>
                                        }
                                        value={row.total}
                                        precision={0}
                                    />
                                </Col>
                            ))}
                        </Row>
                    </Deferred>
                </DashboardPanel>
            </Col>

            <Col xs={24} lg={14}>
                <DashboardPanel
                    title="Market segments"
                    note="By the lead's primary language; sparsely populated, so 'unknown' is shown rather than hidden"
                >
                    <Deferred
                        data="marketSegments"
                        fallback={<PanelSkeleton rows={5} />}
                    >
                        <Table
                            rowKey="segment"
                            size="small"
                            pagination={false}
                            dataSource={marketSegments ?? []}
                            columns={[
                                {
                                    title: td("Segment"),
                                    dataIndex: "segment",
                                    render: (segment: string) =>
                                        segment === "unknown" ? (
                                            <span className="text-slate-400">
                                                {td("Unknown")}
                                            </span>
                                        ) : (
                                            segment.toUpperCase()
                                        ),
                                },
                                {
                                    title: td("Leads"),
                                    dataIndex: "count",
                                    width: 100,
                                },
                                {
                                    title: td("Share"),
                                    dataIndex: "count",
                                    key: "share",
                                    width: 100,
                                    render: (count: number) =>
                                        segmentTotal > 0
                                            ? `${Math.round((count / segmentTotal) * 100)}%`
                                            : "—",
                                },
                            ]}
                        />
                    </Deferred>
                </DashboardPanel>
            </Col>

            <Col xs={24}>
                <DashboardPanel
                    title="Lead sources"
                    note="Volume and contact rate only — no spend data is fed into the CRM, so cost per lead is not available for any channel"
                >
                    <Deferred
                        data="sourceBreakdown"
                        fallback={<PanelSkeleton rows={6} />}
                    >
                        <SourceBreakdown rows={sourceBreakdown ?? []} />
                    </Deferred>
                </DashboardPanel>
            </Col>
        </Row>
    );
}
