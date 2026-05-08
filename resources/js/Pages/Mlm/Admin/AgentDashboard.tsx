import React from "react";
import {
    Card,
    Col,
    Row,
    Tag,
    Statistic,
    Empty,
    Skeleton,
    Divider,
    Avatar,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Users, Award, Clock } from "lucide-react";
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
import useTranslation from "@/Hooks/useTranslation";
import { useAdminAgentDashboard } from "@/Features/Mlm/api";
import {
    LevelBadge,
    CommissionStatusBadge,
    ProgressToNextLevel,
    EnrollmentStatusCard,
    CycleMetricsDisplay,
} from "@/Features/Mlm/Components";
import type {
    LevelData,
    MlmAgentDashboardStats,
    MlmCommission,
} from "@/Features/Mlm/types";
import { COMMISSION_TYPE_LABELS } from "@/Features/Mlm/types";

interface AgentInfo {
    id: number;
    name: string;
    email?: string;
    image?: string | null;
}

interface Props extends PageProps {
    agent: AgentInfo;
    stats: MlmAgentDashboardStats;
}

const AdminAgentDashboard: React.FC<Props> = ({
    agent,
    stats: initialStats,
}) => {
    const { t } = useTranslation();
    const { data, isLoading } = useAdminAgentDashboard(agent.id);
    const stats: MlmAgentDashboardStats = (data as any)?.data ?? initialStats;
    const levelData: LevelData = (data as any)?.data;

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
                title={`${agent.name}'s Dashboard`}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/dashboard" },
                    {
                        name: t("app.mlm.admin.agent_metrics"),
                        url: "/account/mlm/agent-metrics",
                    },
                    { name: agent.name },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Agent Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card
                            variant="outlined"
                            bodyStyle={{ padding: "16px 24px" }}
                        >
                            <div className="flex items-center gap-4">
                                <Avatar
                                    size={48}
                                    src={
                                        agent.image
                                            ? `/img/${agent.image}`
                                            : undefined
                                    }
                                    className="bg-indigo-100 text-indigo-600 font-semibold"
                                >
                                    {agent.name?.charAt(0) ?? "?"}
                                </Avatar>
                                <div>
                                    <div className="font-semibold text-lg">
                                        {agent.name}
                                    </div>
                                    {agent.email && (
                                        <div className="text-sm text-gray-500">
                                            {agent.email}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </motion.div>

                    <Skeleton
                        loading={isLoading && !stats}
                        paragraph={{ rows: 6 }}
                    >
                        {/* Enrollment Status */}
                        {(levelData?.enrollment || levelData?.active_cycle) && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="mb-4"
                            >
                                <EnrollmentStatusCard
                                    enrollment={levelData?.enrollment ?? null}
                                    activeCycle={
                                        levelData?.active_cycle ?? null
                                    }
                                />
                            </motion.div>
                        )}

                        <Row gutter={[16, 16]}>
                            {/* Current Level Card */}
                            <Col xs={24} lg={12}>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    <Card className="h-full" variant="outlined">
                                        <div className="text-center mb-6">
                                            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mb-4">
                                                <Award size={36} />
                                            </div>
                                            <div className="text-sm text-gray-500 mb-2">
                                                Current Level
                                            </div>
                                            {levelData?.current_level ? (
                                                <LevelBadge
                                                    level={
                                                        levelData.current_level
                                                    }
                                                    showPercentage
                                                />
                                            ) : (
                                                <Tag className="text-lg">
                                                    Unranked
                                                </Tag>
                                            )}
                                        </div>

                                        <Divider />

                                        <CycleMetricsDisplay
                                            cycleMetrics={
                                                levelData?.cycle_metrics ?? null
                                            }
                                            allTimeMetrics={
                                                levelData?.all_time_metrics ??
                                                null
                                            }
                                            showToggle
                                            compact
                                        />
                                    </Card>
                                </motion.div>
                            </Col>

                            {/* Progress to Next Level */}
                            <Col xs={24} lg={12}>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.1 }}
                                >
                                    <Card
                                        title={
                                            <div className="flex items-center gap-2">
                                                <TrendingUp
                                                    size={18}
                                                    className="text-green-500"
                                                />
                                                <span className="font-semibold">
                                                    Progress to Next Level
                                                </span>
                                                {levelData?.cycle_metrics && (
                                                    <Tag
                                                        color="blue"
                                                        className="ml-2 text-xs"
                                                    >
                                                        Current Cycle
                                                    </Tag>
                                                )}
                                            </div>
                                        }
                                        className="h-full"
                                        variant="outlined"
                                    >
                                        {levelData?.next_level &&
                                        levelData?.criteria_progress?.length ? (
                                            <div>
                                                <div className="mb-4 flex items-center justify-between">
                                                    <span className="text-sm text-gray-500">
                                                        Next:{" "}
                                                        <strong>
                                                            {
                                                                levelData
                                                                    .next_level
                                                                    .name
                                                            }
                                                        </strong>
                                                    </span>
                                                    <Tag color="blue">
                                                        {
                                                            levelData.next_level
                                                                .commission_percentage
                                                        }
                                                        % commission
                                                    </Tag>
                                                </div>
                                                <ProgressToNextLevel
                                                    currentLevel={
                                                        levelData.current_level
                                                    }
                                                    nextLevel={
                                                        levelData.next_level
                                                    }
                                                    overallProgress={
                                                        (levelData.criteria_progress?.reduce(
                                                            (sum, c) =>
                                                                sum +
                                                                (c.percentage ??
                                                                    0),
                                                            0,
                                                        ) ?? 0) /
                                                        (levelData
                                                            .criteria_progress
                                                            ?.length || 1)
                                                    }
                                                    criteriaProgress={
                                                        levelData.criteria_progress
                                                    }
                                                />
                                            </div>
                                        ) : (
                                            <Empty
                                                description={
                                                    levelData?.current_level
                                                        ? "This agent has reached the highest level!"
                                                        : "No criteria progress yet."
                                                }
                                            />
                                        )}
                                    </Card>
                                </motion.div>
                            </Col>
                        </Row>

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
                                            variant="outlined"
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
                                                Commission Trend
                                            </span>
                                        }
                                        variant="outlined"
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
                                                            id="adminAgentCommGrad"
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
                                                        fill="url(#adminAgentCommGrad)"
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
                                        variant="outlined"
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
                                variant="outlined"
                            >
                                <DataTable
                                    columns={recentCommissionCols}
                                    dataSource={stats.recent_commissions ?? []}
                                    rowKey="id"
                                    size="small"
                                    scroll={{ x: "max-content" }}
                                    emptyState={{ description: "No commissions yet" }}
                                />
                            </Card>
                        </motion.div>
                    </Skeleton>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default AdminAgentDashboard;
