import React from "react";
import { Card, Row, Col, Progress } from "antd";
import { motion } from "framer-motion";
import StatCard from "@/Components/Dashboard/StatCard";
import {
    LucideIcon,
    User2Icon as UserAddOutlined,
    DollarSign as DollarOutlined,
    CheckCircle2Icon as CheckCircleOutlined,
    Clock2Icon as ClockCircleOutlined,
    LucideTrophy as TrophyOutlined,
    PercentCircle as PercentageOutlined,
} from "lucide-react";

interface MetricCardProps {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    progress?: {
        current: number;
        target: number;
    };
    onClick?: () => void;
    delay?: number;
}

interface OverviewMetrics {
    activeLeads: number;
    openDeals: number;
    closedDeals: number;
    quotaProgress: {
        current: number;
        target: number;
    };
    pendingActivities: number;
    conversionRate: number;
    trends?: {
        activeLeads?: { value: number; isPositive: boolean };
        openDeals?: { value: number; isPositive: boolean };
        closedDeals?: { value: number; isPositive: boolean };
        conversionRate?: { value: number; isPositive: boolean };
    };
}

interface OverviewMetricsBarProps {
    metrics: OverviewMetrics;
    onMetricClick?: (metricType: string) => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    icon,
    color,
    trend,
    progress,
    onClick,
    delay = 0,
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ scale: 1.02 }}
            className="h-full"
        >
            <Card
                className={`h-full cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    onClick ? "hover:border-blue-400" : ""
                }`}
                style={{
                    background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                    border: "none",
                    borderRadius: "12px",
                }}
                onClick={onClick}
                bodyStyle={{ padding: "20px" }}
            >
                <div className="flex items-center justify-between text-white">
                    <div className="flex-1">
                        <div className="text-white/80 text-sm font-medium mb-2">
                            {title}
                        </div>
                        <div className="text-2xl font-bold mb-2">
                            {typeof value === "number" && value > 999
                                ? `${(value / 1000).toFixed(1)}k`
                                : value}
                        </div>

                        {/* Progress Bar for Quota */}
                        {progress && (
                            <div className="mb-2">
                                <Progress
                                    percent={Math.round(
                                        (progress.current / progress.target) *
                                            100
                                    )}
                                    size="small"
                                    strokeColor="#fff"
                                    trailColor="rgba(255,255,255,0.3)"
                                    showInfo={false}
                                />
                                <div className="text-xs text-white/80 mt-1">
                                    {progress.current} / {progress.target}
                                </div>
                            </div>
                        )}

                        {/* Trend Indicator */}
                        {trend && (
                            <div
                                className={`text-sm flex items-center ${
                                    trend.isPositive
                                        ? "text-green-200"
                                        : "text-red-200"
                                }`}
                            >
                                <span className="mr-1">
                                    {trend.isPositive ? "↗" : "↘"}
                                </span>
                                {Math.abs(trend.value)}%
                                <span className="text-white/60 ml-1">
                                    vs last month
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="text-4xl opacity-80 ml-4">{icon}</div>
                </div>
            </Card>
        </motion.div>
    );
};

const OverviewMetricsBar: React.FC<OverviewMetricsBarProps> = ({
    metrics,
    onMetricClick,
}) => {
    const metricsData: Array<{
        title: string;
        value: number | string;
        icon: LucideIcon;
        gradient: string;
        trend?: { value: number; isPositive: boolean };
        progress?: { current: number; target: number };
        key: string;
    }> = [
        {
            title: "Active Leads",
            value: metrics.activeLeads,
            icon: UserAddOutlined,
            gradient: "bg-gradient-to-br from-blue-400 to-blue-600", // Blue
            trend: metrics.trends?.activeLeads,
            key: "activeLeads",
        },
        {
            title: "Open Deals",
            value: metrics.openDeals,
            icon: DollarOutlined,
            gradient: "bg-gradient-to-br from-yellow-400 to-yellow-600", // Amber
            trend: metrics.trends?.openDeals,
            key: "openDeals",
        },
        {
            title: "Closed Deals",
            value: metrics.closedDeals,
            icon: CheckCircleOutlined,
            gradient: "bg-gradient-to-br from-emerald-400 to-emerald-600", // Emerald
            trend: metrics.trends?.closedDeals,
            key: "closedDeals",
        },
        {
            title: "Quota Progress",
            value: `${Math.round(
                (metrics.quotaProgress.current / metrics.quotaProgress.target) *
                    100
            )}%`,
            icon: TrophyOutlined,
            gradient: "bg-gradient-to-br from-purple-400 to-purple-600", // Purple
            progress: metrics.quotaProgress,
            key: "quotaProgress",
        },
        {
            title: "Pending Tasks",
            value: metrics.pendingActivities,
            icon: ClockCircleOutlined,
            gradient: "bg-gradient-to-br from-red-400 to-red-600", // Red
            key: "pendingActivities",
        },
        {
            title: "Conversion Rate",
            value: `${metrics.conversionRate}%`,
            icon: PercentageOutlined,
            gradient: "bg-gradient-to-br from-cyan-400 to-cyan-600", // Cyan
            trend: metrics.trends?.conversionRate,
            key: "conversionRate",
        },
    ];

    return (
        <div className="mb-8">
            <Row gutter={[16, 16]}>
                {metricsData.map((metric, index) => (
                    <Col xs={24} sm={12} lg={8} xl={4} key={metric.key}>
                        <StatCard
                            title={metric.title}
                            value={metric.value}
                            // icon={metric.icon}
                            gradient={metric.gradient}
                            // trend={metric.trend}
                            // progress={metric.progress}
                            onClick={() => onMetricClick?.(metric.key)}
                            delay={index * 0.1}
                        />
                    </Col>
                ))}
            </Row>
        </div>
    );
};

export default OverviewMetricsBar;
