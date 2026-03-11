import React from "react";
import {
    Card,
    Col,
    Row,
    Table,
    Tag,
    Statistic,
    Empty,
    Spin,
    Skeleton,
} from "antd";
import { motion } from "framer-motion";
import {
    DollarSign,
    TrendingUp,
    Users,
    Award,
    ArrowUpRight,
    Clock,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from "recharts";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useMlmAgentDashboard } from "@/Features/Mlm/api";
import {
    LevelBadge,
    CommissionStatusBadge,
    ProgressToNextLevel,
} from "@/Features/Mlm/Components";
import type {
    MlmAgentDashboardStats,
    MlmCommission,
} from "@/Features/Mlm/types";
import { COMMISSION_TYPE_LABELS } from "@/Features/Mlm/types";

interface Props extends PageProps {
    stats: MlmAgentDashboardStats;
}

const AgentDashboard: React.FC<Props> = ({ stats: initialStats }) => {
    const { data, isLoading } = useMlmAgentDashboard();
    const stats: MlmAgentDashboardStats = (data as any)?.data ?? initialStats;

    const statCards = [
        {
            title: "Total Earnings",
            value: stats.total_earnings ?? 0,
            prefix: "$",
            precision: 2,
            icon: <DollarSign size={20} />,
            iconBg: "bg-green-100 text-green-600",
        },
        {
            title: "Pending Earnings",
            value: stats.pending_earnings ?? 0,
            prefix: "$",
            precision: 2,
            icon: <Clock size={20} />,
            iconBg: "bg-orange-100 text-orange-600",
        },
        {
            title: "Total Sales",
            value: stats.total_sales ?? 0,
            icon: <TrendingUp size={20} />,
            iconBg: "bg-blue-100 text-blue-600",
        },
        {
            title: "Downlines",
            value: stats.total_downlines ?? 0,
            icon: <Users size={20} />,
            iconBg: "bg-purple-100 text-purple-600",
        },
    ];

    const recentCommissionCols = [
        {
            title: "Deal",
            key: "deal",
            render: (_: any, r: MlmCommission) => (
                <span className="font-medium text-sm">
                    {r.deal?.name ?? `Deal #${r.deal_id}`}
                </span>
            ),
        },
        {
            title: "Type",
            dataIndex: "type",
            key: "type",
            render: (t: string) => (
                <Tag
                    color={
                        t === "agent"
                            ? "blue"
                            : t === "upline"
                              ? "purple"
                              : "default"
                    }
                >
                    {COMMISSION_TYPE_LABELS[
                        t as keyof typeof COMMISSION_TYPE_LABELS
                    ] ?? t}
                </Tag>
            ),
        },
        {
            title: "Amount",
            dataIndex: "amount",
            key: "amount",
            align: "right" as const,
            render: (val: number) => (
                <span className="font-semibold text-green-600">
                    $
                    {val?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                    })}
                </span>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (s: any) => <CommissionStatusBadge status={s} />,
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title="My MLM Dashboard"
                breadcrumbs={[{ name: "MLM" }, { name: "Dashboard" }]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <Skeleton
                        loading={isLoading && !stats}
                        paragraph={{ rows: 6 }}
                    >
                        {/* Current Level & Progress */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="mb-6"
                        >
                            <Card className="shadow-sm">
                                <div className="flex flex-col md:flex-row md:items-center gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                                            <Award size={28} />
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">
                                                Current Level
                                            </div>
                                            {stats.current_level ? (
                                                <LevelBadge
                                                    level={stats.current_level}
                                                    showPercentage
                                                />
                                            ) : (
                                                <Tag>Unranked</Tag>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        {stats.next_level &&
                                        stats.criteria_progress ? (
                                            <ProgressToNextLevel
                                                currentLevel={
                                                    stats.current_level
                                                }
                                                nextLevel={stats.next_level}
                                                overallProgress={
                                                    stats.progress_percentage
                                                }
                                                criteriaProgress={
                                                    stats.criteria_progress
                                                }
                                            />
                                        ) : (
                                            <div className="text-sm text-gray-500">
                                                {stats.current_level
                                                    ? "You've reached the highest level!"
                                                    : "Complete criteria to earn your first level."}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* Stat Cards */}
                        <Row gutter={[16, 16]} className="mb-6">
                            {statCards.map((card, idx) => (
                                <Col xs={12} sm={12} lg={6} key={card.title}>
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.3,
                                            delay: idx * 0.08,
                                        }}
                                    >
                                        <Card
                                            className="shadow-sm"
                                            bodyStyle={{ padding: "16px 20px" }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <Statistic
                                                    title={
                                                        <span className="text-xs">
                                                            {card.title}
                                                        </span>
                                                    }
                                                    value={card.value}
                                                    prefix={card.prefix}
                                                    precision={card.precision}
                                                    valueStyle={{
                                                        fontSize: 22,
                                                        fontWeight: 700,
                                                    }}
                                                />
                                                <div
                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}
                                                >
                                                    {card.icon}
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                </Col>
                            ))}
                        </Row>

                        {/* Charts Row */}
                        <Row gutter={[16, 16]} className="mb-6">
                            <Col xs={24} lg={14}>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.3 }}
                                >
                                    <Card
                                        title={
                                            <span className="font-semibold text-sm">
                                                My Commission Trend
                                            </span>
                                        }
                                        className="shadow-sm"
                                    >
                                        {stats.monthly_commissions?.length ? (
                                            <ResponsiveContainer
                                                width="100%"
                                                height={250}
                                            >
                                                <AreaChart
                                                    data={
                                                        stats.monthly_commissions
                                                    }
                                                >
                                                    <defs>
                                                        <linearGradient
                                                            id="agentCommGrad"
                                                            x1="0"
                                                            y1="0"
                                                            x2="0"
                                                            y2="1"
                                                        >
                                                            <stop
                                                                offset="5%"
                                                                stopColor="#10b981"
                                                                stopOpacity={
                                                                    0.3
                                                                }
                                                            />
                                                            <stop
                                                                offset="95%"
                                                                stopColor="#10b981"
                                                                stopOpacity={0}
                                                            />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid
                                                        strokeDasharray="3 3"
                                                        stroke="#f0f0f0"
                                                    />
                                                    <XAxis
                                                        dataKey="month"
                                                        tick={{ fontSize: 11 }}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 11 }}
                                                    />
                                                    <Tooltip
                                                        formatter={(
                                                            value: any,
                                                        ) => [
                                                            `$${Number(value).toLocaleString()}`,
                                                            "Earnings",
                                                        ]}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="amount"
                                                        stroke="#10b981"
                                                        strokeWidth={2}
                                                        fill="url(#agentCommGrad)"
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <Empty description="No commission data yet" />
                                        )}
                                    </Card>
                                </motion.div>
                            </Col>

                            <Col xs={24} lg={10}>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.4 }}
                                >
                                    <Card
                                        title={
                                            <span className="font-semibold text-sm">
                                                Network Growth
                                            </span>
                                        }
                                        className="shadow-sm"
                                    >
                                        {stats.network_growth?.length ? (
                                            <ResponsiveContainer
                                                width="100%"
                                                height={250}
                                            >
                                                <BarChart
                                                    data={stats.network_growth}
                                                >
                                                    <CartesianGrid
                                                        strokeDasharray="3 3"
                                                        stroke="#f0f0f0"
                                                    />
                                                    <XAxis
                                                        dataKey="month"
                                                        tick={{ fontSize: 11 }}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 11 }}
                                                    />
                                                    <Tooltip />
                                                    <Bar
                                                        dataKey="count"
                                                        fill="#6366f1"
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <Empty description="No network data yet" />
                                        )}
                                    </Card>
                                </motion.div>
                            </Col>
                        </Row>

                        {/* Recent Commissions */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                        >
                            <Card
                                title={
                                    <span className="font-semibold text-sm">
                                        Recent Commissions
                                    </span>
                                }
                                className="shadow-sm"
                            >
                                <Table
                                    columns={recentCommissionCols}
                                    dataSource={stats.recent_commissions ?? []}
                                    rowKey="id"
                                    pagination={false}
                                    size="small"
                                    locale={{
                                        emptyText: (
                                            <Empty description="No commissions yet" />
                                        ),
                                    }}
                                />
                            </Card>
                        </motion.div>
                    </Skeleton>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default AgentDashboard;
