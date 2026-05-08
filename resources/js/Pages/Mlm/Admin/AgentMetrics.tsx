import React, { useState } from "react";
import { Card, Tag, Input, Select, Empty, Progress, Space } from "antd";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { motion } from "framer-motion";
import { BarChart3, Search } from "lucide-react";
import { router } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import { useAgentMetrics } from "@/Features/Mlm/api";
import { LevelBadge, ProgressToNextLevel } from "@/Features/Mlm/Components";
import type {
    AgentMetricWithProgress,
    PaginatedResponse,
} from "@/Features/Mlm/types";
import { formatNumber } from "@/lib/utils";

interface Props extends PageProps {
    metrics: PaginatedResponse<AgentMetricWithProgress>;
}

const MlmAgentMetrics: React.FC<Props> = ({ metrics: initialMetrics }) => {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [levelFilter, setLevelFilter] = useState<string | undefined>();

    const { data, isLoading } = useAgentMetrics({
        page,
        per_page: 20,
        ...(search ? { search } : {}),
        ...(levelFilter ? { level: levelFilter } : {}),
    });

    const metrics: PaginatedResponse<AgentMetricWithProgress> =
        (data as any) ?? initialMetrics;

    const columns = [
        {
            title: "Agent",
            key: "agent",
            render: (_: any, record: AgentMetricWithProgress) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-semibold">
                        {record.agent?.user?.name?.charAt(0) ?? "?"}
                    </div>
                    <div>
                        <button
                            type="button"
                            className="font-medium text-sm text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer bg-transparent border-0 p-0 text-left"
                            onClick={() =>
                                router.visit(
                                    `/account/mlm/agents/${record.agent_id}/dashboard`,
                                )
                            }
                        >
                            {record.agent?.user?.name ?? "Unknown"}
                        </button>
                        <div className="text-xs text-gray-500">
                            {record.agent?.user?.email}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: "Current Level",
            key: "level",
            render: (_: any, record: AgentMetricWithProgress) =>
                record.current_level ? (
                    <LevelBadge level={record.current_level} />
                ) : (
                    <Tag>Unranked</Tag>
                ),
        },
        {
            title: "Individual Sales",
            dataIndex: "nsa",
            key: "nsa",
            align: "right" as const,
            render: (val: number) => formatNumber(val ?? 0),
        },
        {
            title: "Team Sales",
            dataIndex: "nsd",
            key: "nsd",
            align: "right" as const,
            render: (val: number) => formatNumber(val ?? 0),
        },
        {
            title: "Individual Revenue",
            dataIndex: "vsa",
            key: "vsa",
            align: "right" as const,
            render: (val: number) => `$${formatNumber(val ?? 0)}`,
        },
        {
            title: "Team Revenue",
            dataIndex: "vsd",
            key: "vsd",
            align: "right" as const,
            render: (val: number) => `$${formatNumber(val ?? 0)}`,
        },
        {
            title: "Progress to Next",
            key: "progress",
            width: 200,
            render: (_: any, record: AgentMetricWithProgress) =>
                record.next_level ? (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">
                                → {record.next_level.name}
                            </span>
                            <span className="text-xs font-medium">
                                {record.progress_percentage ?? 0}%
                            </span>
                        </div>
                        <Progress
                            percent={record.progress_percentage ?? 0}
                            showInfo={false}
                            size="small"
                            strokeColor={
                                (record.progress_percentage ?? 0) >= 100
                                    ? "#16a34a"
                                    : "#6366f1"
                            }
                        />
                    </div>
                ) : (
                    <Tag color="gold">Max Level</Tag>
                ),
        },
    ];

    const expandedRowRender = (record: AgentMetricWithProgress) =>
        record.criteria_progress?.length ? (
            <div className="px-4 py-2">
                <ProgressToNextLevel
                    currentLevel={record.current_level ?? null}
                    nextLevel={record.next_level ?? null}
                    overallProgress={record.progress_percentage ?? 0}
                    criteriaProgress={record.criteria_progress ?? []}
                    compact
                />
            </div>
        ) : (
            <div className="px-4 py-2 text-sm text-gray-500">
                No criteria progress data
            </div>
        );

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.mlm.admin.agent_metrics")}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/dashboard" },
                    { name: t("app.mlm.admin.agent_metrics") },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <Card
                            title={
                                <div className="flex items-center gap-2">
                                    <BarChart3
                                        size={18}
                                        className="text-indigo-500"
                                    />
                                    <span className="font-semibold">
                                        Agent Performance Metrics
                                    </span>
                                </div>
                            }
                            className="shadow-sm"
                        >
                            {/* Search / Filters */}
                            <div className="flex flex-wrap gap-3 mb-4">
                                <Input
                                    prefix={<Search size={14} />}
                                    placeholder="Search agent..."
                                    className="w-64"
                                    allowClear
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                />
                            </div>

                            <DataTable
                                columns={columns}
                                dataSource={metrics?.data ?? []}
                                rowKey="id"
                                loading={isLoading}
                                size="middle"
                                expandable={{
                                    expandedRowRender,
                                    rowExpandable: (record) =>
                                        !!record.criteria_progress?.length,
                                }}
                                paginationData={{
                                    current_page: metrics?.current_page ?? 1,
                                    last_page: Math.ceil((metrics?.total ?? 0) / (metrics?.per_page ?? 20)),
                                    per_page: metrics?.per_page ?? 20,
                                    total: metrics?.total ?? 0,
                                    from: null,
                                    to: null,
                                }}
                                onPageChange={(p) => setPage(p)}
                                emptyState={{ description: "No agent metrics found" }}
                                scroll={{ x: "max-content" }}
                            />
                        </Card>
                    </motion.div>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MlmAgentMetrics;
