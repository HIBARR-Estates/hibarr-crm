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
    Users,
    DollarSign,
    TrendingUp,
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
} from "recharts";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useMlmAdminDashboard } from "@/Features/Mlm/api";
import { LevelBadge } from "@/Features/Mlm/Components";
import type { MlmAdminDashboardStats } from "@/Features/Mlm/types";

interface Props extends PageProps {
    stats: MlmAdminDashboardStats;
}

const statCards = (stats: MlmAdminDashboardStats) => [
    {
        title: "Total Agents",
        value: stats.total_agents,
        icon: <Users size={22} />,
        color: "from-blue-500 to-blue-600",
        iconBg: "bg-blue-100 text-blue-600",
    },
    {
        title: "Deals Won",
        value: stats.total_deals_won,
        icon: <TrendingUp size={22} />,
        color: "from-green-500 to-green-600",
        iconBg: "bg-green-100 text-green-600",
    },
    {
        title: "Commissions Paid",
        value: stats.total_commissions_paid,
        prefix: "$",
        icon: <DollarSign size={22} />,
        color: "from-purple-500 to-purple-600",
        iconBg: "bg-purple-100 text-purple-600",
    },
    {
        title: "Pending Payouts",
        value: stats.pending_commissions,
        prefix: "$",
        icon: <Clock size={22} />,
        color: "from-orange-500 to-orange-600",
        iconBg: "bg-orange-100 text-orange-600",
    },
];

const MlmAdminDashboard: React.FC<Props> = ({ stats: initialStats }) => {
    const { data, isLoading } = useMlmAdminDashboard();
    const stats: MlmAdminDashboardStats = (data as any)?.data ?? initialStats;

    const cards = statCards(stats);

    const topAgentColumns = [
        {
            title: "Agent",
            dataIndex: ["user", "name"],
            key: "name",
            render: (_: any, record: any) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-semibold">
                        {record.user?.name?.charAt(0) ?? "?"}
                    </div>
                    <div>
                        <div className="font-medium text-sm">
                            {record.user?.name ?? "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500">
                            {record.user?.email}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: "Level",
            key: "level",
            render: (_: any, record: any) =>
                record.current_level_history?.level ? (
                    <LevelBadge level={record.current_level_history.level} />
                ) : (
                    <Tag>Unranked</Tag>
                ),
        },
        {
            title: "Deals",
            dataIndex: "deals_count",
            key: "deals_count",
            align: "right" as const,
        },
        {
            title: "Total Earned",
            dataIndex: "total_earned",
            key: "total_earned",
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
    ];

    const promotionColumns = [
        {
            title: "Agent",
            key: "agent",
            render: (_: any, record: any) => (
                <span className="font-medium">
                    {record.agent?.user?.name ?? "—"}
                </span>
            ),
        },
        {
            title: "New Level",
            key: "level",
            render: (_: any, record: any) =>
                record.level ? <LevelBadge level={record.level} /> : "—",
        },
        {
            title: "Date",
            dataIndex: "assigned_at",
            key: "assigned_at",
            render: (d: string) => (d ? new Date(d).toLocaleDateString() : "—"),
        },
        {
            title: "Method",
            key: "method",
            render: (_: any, record: any) => (
                <Tag color={record.system_assigned ? "blue" : "gold"}>
                    {record.system_assigned ? "Automatic" : "Manual"}
                </Tag>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title="MLM Dashboard"
                breadcrumbs={[
                    { name: "MLM", url: "/account/mlm/dashboard" },
                    { name: "Dashboard" },
                ]}
            >
                <Skeleton
                    loading={isLoading && !stats}
                    active
                    paragraph={{ rows: 4 }}
                >
                    {/* Stat Cards */}
                    <Row gutter={[16, 16]} className="mb-6">
                        {cards.map((card, idx) => (
                            <Col xs={24} sm={12} lg={6} key={card.title}>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                        duration: 0.4,
                                        delay: idx * 0.1,
                                    }}
                                >
                                    <Card
                                        className="shadow-sm hover:shadow-md transition-shadow border-0"
                                        bodyStyle={{ padding: "20px 24px" }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                                                    {card.title}
                                                </div>
                                                <div className="text-2xl font-bold text-gray-900">
                                                    {card.prefix}
                                                    {typeof card.value ===
                                                    "number"
                                                        ? card.value.toLocaleString()
                                                        : card.value}
                                                </div>
                                            </div>
                                            <div
                                                className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.iconBg}`}
                                            >
                                                {card.icon}
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            </Col>
                        ))}
                    </Row>

                    {/* Commission Trend Chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="mb-6"
                    >
                        <Card
                            title={
                                <span className="font-semibold">
                                    Monthly Commission Trend
                                </span>
                            }
                            className="shadow-sm"
                        >
                            {stats.monthly_commissions?.length ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={stats.monthly_commissions}>
                                        <defs>
                                            <linearGradient
                                                id="commGrad"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="5%"
                                                    stopColor="#6366f1"
                                                    stopOpacity={0.3}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor="#6366f1"
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
                                            tick={{ fontSize: 12 }}
                                        />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            formatter={(value: any) => [
                                                `$${Number(value).toLocaleString()}`,
                                                "Commission",
                                            ]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="amount"
                                            stroke="#6366f1"
                                            strokeWidth={2}
                                            fill="url(#commGrad)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <Empty description="No commission data yet" />
                            )}
                        </Card>
                    </motion.div>

                    {/* Top Agents & Recent Promotions */}
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={14}>
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.5 }}
                            >
                                <Card
                                    title={
                                        <div className="flex items-center gap-2">
                                            <Award
                                                size={18}
                                                className="text-yellow-500"
                                            />
                                            <span className="font-semibold">
                                                Top Agents
                                            </span>
                                        </div>
                                    }
                                    className="shadow-sm"
                                >
                                    <Table
                                        columns={topAgentColumns}
                                        dataSource={stats.top_agents ?? []}
                                        rowKey="id"
                                        pagination={false}
                                        size="small"
                                        locale={{
                                            emptyText: (
                                                <Empty description="No agents yet" />
                                            ),
                                        }}
                                    />
                                </Card>
                            </motion.div>
                        </Col>

                        <Col xs={24} lg={10}>
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.6 }}
                            >
                                <Card
                                    title={
                                        <div className="flex items-center gap-2">
                                            <ArrowUpRight
                                                size={18}
                                                className="text-green-500"
                                            />
                                            <span className="font-semibold">
                                                Recent Promotions
                                            </span>
                                        </div>
                                    }
                                    className="shadow-sm"
                                >
                                    <Table
                                        columns={promotionColumns}
                                        dataSource={
                                            stats.recent_promotions ?? []
                                        }
                                        rowKey="id"
                                        pagination={false}
                                        size="small"
                                        locale={{
                                            emptyText: (
                                                <Empty description="No promotions yet" />
                                            ),
                                        }}
                                    />
                                </Card>
                            </motion.div>
                        </Col>
                    </Row>
                </Skeleton>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MlmAdminDashboard;
