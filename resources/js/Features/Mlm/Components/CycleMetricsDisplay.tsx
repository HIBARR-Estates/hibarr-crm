import React, { useState } from "react";
import { Card, Row, Col, Statistic, Switch } from "antd";
import { BarChart3 } from "lucide-react";

interface MetricSet {
    nsa: number;
    nsd: number;
    vsa: number;
    vsd: number;
}

interface Props {
    cycleMetrics: MetricSet | null;
    allTimeMetrics?: MetricSet | null;
    /** If true, show toggle between cycle and all-time */
    showToggle?: boolean;
    compact?: boolean;
}

const CycleMetricsDisplay: React.FC<Props> = ({
    cycleMetrics,
    allTimeMetrics,
    showToggle = true,
    compact = false,
}) => {
    const [showAllTime, setShowAllTime] = useState(false);

    const metrics =
        showAllTime && allTimeMetrics
            ? allTimeMetrics
            : (cycleMetrics ?? allTimeMetrics);

    if (!metrics) {
        return (
            <Card size="small" className="shadow-sm">
                <div className="text-center text-sm text-gray-400 py-4">
                    No metrics data available
                </div>
            </Card>
        );
    }

    const items = [
        {
            title: "Individual Sales",
            value: metrics.nsa,
        },
        {
            title: "Team Sales",
            value: metrics.nsd,
        },
        {
            title: "Individual Revenue",
            value: metrics.vsa,
            prefix: "$",
        },
        {
            title: "Team Revenue",
            value: metrics.vsd,
            prefix: "$",
        },
    ];

    return (
        <Card
            size="small"
            className="shadow-sm"
            title={
                showToggle && allTimeMetrics && cycleMetrics ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BarChart3 size={16} className="text-indigo-500" />
                            <span className="font-semibold text-sm">
                                {showAllTime
                                    ? "All-Time Metrics"
                                    : "Cycle Metrics"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span
                                className={
                                    !showAllTime
                                        ? "font-semibold"
                                        : "text-gray-400"
                                }
                            >
                                Cycle
                            </span>
                            <Switch
                                size="small"
                                checked={showAllTime}
                                onChange={setShowAllTime}
                            />
                            <span
                                className={
                                    showAllTime
                                        ? "font-semibold"
                                        : "text-gray-400"
                                }
                            >
                                All-Time
                            </span>
                        </div>
                    </div>
                ) : undefined
            }
        >
            <Row gutter={[compact ? 8 : 16, compact ? 8 : 16]}>
                {items.map((item) => (
                    <Col xs={12} sm={6} key={item.title}>
                        <Statistic
                            title={
                                <span className="text-xs">{item.title}</span>
                            }
                            value={item.value}
                            prefix={item.prefix}
                            precision={item.prefix ? 2 : 0}
                            valueStyle={{
                                fontSize: compact ? 16 : 20,
                                fontWeight: 600,
                            }}
                        />
                    </Col>
                ))}
            </Row>
        </Card>
    );
};

export default CycleMetricsDisplay;
