import React, { useEffect } from "react";
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
    Form,
    InputNumber,
    Button,
    Input,
    message,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import { motion } from "framer-motion";
import {
    DollarSign,
    TrendingUp,
    Users,
    Award,
    Clock,
    Percent,
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
import useTranslation from "@/Hooks/useTranslation";
import { usePage } from "@inertiajs/react";
import {
    useAdminAgentDashboard,
    useAgentCommissionProfile,
    useUpdateAgentCommissionProfile,
} from "@/Features/Mlm/api";
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
    AgentCommissionProfile,
    AgentCommissionProfileUpdatePayload,
    AgentCommissionRateAuditLog,
} from "@/Features/Mlm/types";
import { COMMISSION_TYPE_LABELS } from "@/Features/Mlm/types";
import { formatCompanyDateTime } from "@/lib/companyDateTime";

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
    const { props } = usePage<PageProps>();
    const commissionOverrideEnabled =
        props.featureFlags?.["sales.per-agent-commission-override"] === true;
    const { data, isLoading } = useAdminAgentDashboard(agent.id);
    const {
        data: profileData,
        isLoading: profileLoading,
        refetch: refetchProfile,
    } = useAgentCommissionProfile(agent.id, commissionOverrideEnabled);
    const [commissionForm] =
        Form.useForm<AgentCommissionProfileUpdatePayload>();

    const updateCommissionProfile = useUpdateAgentCommissionProfile(
        agent.id,
        () => {
            message.success("Commission rates updated");
            refetchProfile();
        },
    );

    const commissionProfile: AgentCommissionProfile | undefined =
        (profileData as any)?.data?.data ?? (profileData as any)?.data;

    useEffect(() => {
        if (commissionProfile) {
            commissionForm.setFieldsValue({
                custom_commission_rate:
                    commissionProfile.custom_commission_rate,
            });
        }
    }, [commissionProfile, commissionForm]);

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
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <LevelBadge
                                                            level={
                                                                levelData.current_level
                                                            }
                                                            showPercentage
                                                        />
                                                        {commissionOverrideEnabled &&
                                                            commissionProfile
                                                                ?.custom_commission_rate !=
                                                                null && (
                                                                <Tag color="gold">
                                                                    Custom rate:{" "}
                                                                    {
                                                                        commissionProfile
                                                                            .custom_commission_rate
                                                                    }
                                                                    %
                                                                </Tag>
                                                            )}
                                                    </div>
                                                    {levelData.current_level
                                                        .is_hidden && (
                                                        <Tag color="default">
                                                            Hidden
                                                        </Tag>
                                                    )}
                                                </div>
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
                                    emptyState={{
                                        description: "No commissions yet",
                                    }}
                                />
                            </Card>
                        </motion.div>

                        {commissionOverrideEnabled && (
                            <Row gutter={[16, 16]} className="mb-6">
                                <Col xs={24}>
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.4,
                                            delay: 0.15,
                                        }}
                                    >
                                        <Card
                                            title={
                                                <div className="flex items-center gap-2">
                                                    <Percent
                                                        size={18}
                                                        className="text-indigo-500"
                                                    />
                                                    <span className="font-semibold">
                                                        Commission Rate
                                                        Overrides
                                                    </span>
                                                </div>
                                            }
                                            variant="outlined"
                                        >
                                            <Skeleton loading={profileLoading}>
                                                {commissionProfile ? (
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                            <div>
                                                                <span className="text-gray-500">
                                                                    Level
                                                                    default
                                                                </span>
                                                                <div className="font-medium">
                                                                    {commissionProfile
                                                                        .level
                                                                        ?.default_commission_rate ??
                                                                        "—"}
                                                                    %
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">
                                                                    Max allowed
                                                                </span>
                                                                <div className="font-medium">
                                                                    ≤{" "}
                                                                    {
                                                                        commissionProfile
                                                                            .bounds
                                                                            .max_ceiling
                                                                    }
                                                                    %
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">
                                                                    Status
                                                                </span>
                                                                <div>
                                                                    {commissionProfile
                                                                        .bounds
                                                                        .is_highest_visible_level ? (
                                                                        <Tag color="gold">
                                                                            Highest
                                                                            visible
                                                                            level
                                                                        </Tag>
                                                                    ) : (
                                                                        <Tag color="blue">
                                                                            Bounded
                                                                            by
                                                                            next
                                                                            level
                                                                        </Tag>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <Form
                                                            form={
                                                                commissionForm
                                                            }
                                                            layout="vertical"
                                                            onFinish={(
                                                                values,
                                                            ) =>
                                                                updateCommissionProfile.mutate(
                                                                    values,
                                                                )
                                                            }
                                                        >
                                                            <Form.Item
                                                                label="Custom Commission Rate"
                                                                name="custom_commission_rate"
                                                                tooltip="Leave empty to use level default"
                                                                rules={[
                                                                    {
                                                                        validator:
                                                                            async (
                                                                                _,
                                                                                value,
                                                                            ) => {
                                                                                if (
                                                                                    value ===
                                                                                        null ||
                                                                                    value ===
                                                                                        undefined ||
                                                                                    value ===
                                                                                        ""
                                                                                ) {
                                                                                    return;
                                                                                }

                                                                                const max =
                                                                                    commissionProfile
                                                                                        .bounds
                                                                                        .max_ceiling;

                                                                                if (
                                                                                    value <
                                                                                        0 ||
                                                                                    value >
                                                                                        max
                                                                                ) {
                                                                                    throw new Error(
                                                                                        `Rate must be between 0 and ${max}%`,
                                                                                    );
                                                                                }
                                                                            },
                                                                    },
                                                                ]}
                                                            >
                                                                <InputNumber
                                                                    min={0}
                                                                    max={
                                                                        commissionProfile
                                                                            .bounds
                                                                            .max_ceiling
                                                                    }
                                                                    className="w-full"
                                                                    addonAfter="%"
                                                                    placeholder={commissionProfile.level?.default_commission_rate?.toString()}
                                                                />
                                                            </Form.Item>
                                                            <Form.Item
                                                                label="Reason"
                                                                name="reason"
                                                            >
                                                                <Input.TextArea
                                                                    rows={2}
                                                                    placeholder="Optional reason for audit log"
                                                                />
                                                            </Form.Item>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    type="primary"
                                                                    htmlType="submit"
                                                                    loading={
                                                                        updateCommissionProfile.isPending
                                                                    }
                                                                >
                                                                    Save
                                                                    Override
                                                                </Button>
                                                                <Button
                                                                    onClick={() =>
                                                                        updateCommissionProfile.mutate(
                                                                            {
                                                                                custom_commission_rate:
                                                                                    null,
                                                                                reason: "Cleared custom rate",
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    Clear
                                                                    Override
                                                                </Button>
                                                            </div>
                                                        </Form>

                                                        {commissionProfile.audit
                                                            ?.data?.length ? (
                                                            <>
                                                                <Divider />
                                                                <DataTable
                                                                    columns={[
                                                                        {
                                                                            title: "Changed At",
                                                                            dataIndex:
                                                                                "changed_at",
                                                                            key: "changed_at",
                                                                            render: (
                                                                                val: string,
                                                                            ) =>
                                                                                formatCompanyDateTime(
                                                                                    val,
                                                                                ),
                                                                        },
                                                                        {
                                                                            title: "Rate",
                                                                            key: "rate",
                                                                            render: (
                                                                                _: unknown,
                                                                                row: AgentCommissionRateAuditLog,
                                                                            ) =>
                                                                                `${row.previous_direct_rate ?? "—"} → ${row.new_direct_rate ?? "—"}`,
                                                                        },
                                                                        {
                                                                            title: "By",
                                                                            key: "by",
                                                                            render: (
                                                                                _: unknown,
                                                                                row: any,
                                                                            ) =>
                                                                                row
                                                                                    .changed_by_user
                                                                                    ?.name ??
                                                                                "System",
                                                                        },
                                                                        {
                                                                            title: "Reason",
                                                                            dataIndex:
                                                                                "reason",
                                                                            key: "reason",
                                                                        },
                                                                    ]}
                                                                    dataSource={
                                                                        commissionProfile
                                                                            .audit
                                                                            .data
                                                                    }
                                                                    rowKey="id"
                                                                    size="small"
                                                                    // pagination={false}
                                                                    scroll={{
                                                                        x: "max-content",
                                                                    }}
                                                                />
                                                            </>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <Empty description="No commission profile available" />
                                                )}
                                            </Skeleton>
                                        </Card>
                                    </motion.div>
                                </Col>
                            </Row>
                        )}
                    </Skeleton>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default AdminAgentDashboard;
