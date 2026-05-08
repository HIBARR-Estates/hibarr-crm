import React, { useState } from "react";
import { Card, Tag, Select, DatePicker, Empty, Space } from "antd";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { motion } from "framer-motion";
import { History, ArrowUpRight, User, Bot } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import { useLevelHistory } from "@/Features/Mlm/api";
import { LevelBadge } from "@/Features/Mlm/Components";
import type {
    AgentLevelHistory,
    PaginatedResponse,
} from "@/Features/Mlm/types";

const { RangePicker } = DatePicker;

interface Props extends PageProps {
    history: PaginatedResponse<AgentLevelHistory>;
}

const MlmLevelHistory: React.FC<Props> = ({ history: initialHistory }) => {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<Record<string, any>>({});

    const { data, isLoading } = useLevelHistory({
        page,
        per_page: 20,
        ...filters,
    });

    const history: PaginatedResponse<AgentLevelHistory> =
        (data as any) ?? initialHistory;

    const columns = [
        {
            title: "Agent",
            key: "agent",
            render: (_: any, record: AgentLevelHistory) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-semibold">
                        {record.agent?.user?.name?.charAt(0) ?? "?"}
                    </div>
                    <div>
                        <div className="font-medium text-sm">
                            {record.agent?.user?.name ?? "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500">
                            {record.agent?.user?.email}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: "Promoted To",
            key: "level",
            render: (_: any, record: AgentLevelHistory) =>
                record.level ? (
                    <div className="flex items-center gap-2">
                        <ArrowUpRight size={14} className="text-green-500" />
                        <LevelBadge level={record.level} />
                    </div>
                ) : (
                    "—"
                ),
        },
        {
            title: "Method",
            key: "method",
            render: (_: any, record: AgentLevelHistory) => (
                <Tag
                    icon={
                        record.system_assigned ? (
                            <Bot size={12} className="mr-1 inline" />
                        ) : (
                            <User size={12} className="mr-1 inline" />
                        )
                    }
                    color={record.system_assigned ? "blue" : "gold"}
                >
                    {record.system_assigned ? "Automatic" : "Manual"}
                </Tag>
            ),
        },
        {
            title: "Assigned By",
            key: "assigned_by",
            render: (_: any, record: AgentLevelHistory) =>
                record.system_assigned
                    ? "System"
                    : (record.assigned_by_user?.name ?? "—"),
        },
        {
            title: "Trigger Deal",
            key: "trigger_deal",
            render: (_: any, record: AgentLevelHistory) =>
                record.trigger_deal ? (
                    <div>
                        <div className="text-sm font-medium">
                            {record.trigger_deal.name}
                        </div>
                        <div className="text-xs text-gray-500">
                            ${record.trigger_deal.value?.toLocaleString()}
                        </div>
                    </div>
                ) : (
                    "—"
                ),
        },
        {
            title: "Date",
            dataIndex: "assigned_at",
            key: "assigned_at",
            render: (d: string) =>
                d
                    ? new Date(d).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                      })
                    : "—",
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.mlm.admin.level_history")}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/dashboard" },
                    { name: t("app.mlm.admin.level_history") },
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
                                    <History
                                        size={18}
                                        className="text-indigo-500"
                                    />
                                    <span className="font-semibold">
                                        Level Assignment History
                                    </span>
                                </div>
                            }
                            className="shadow-sm"
                        >
                            {/* Filters */}
                            <div className="flex flex-wrap gap-3 mb-4">
                                <Select
                                    placeholder="Method"
                                    allowClear
                                    className="w-36"
                                    options={[
                                        { value: "system", label: "Automatic" },
                                        { value: "manual", label: "Manual" },
                                    ]}
                                    onChange={(v) =>
                                        setFilters((f) => ({
                                            ...f,
                                            method: v,
                                        }))
                                    }
                                />
                                <RangePicker
                                    onChange={(dates) => {
                                        if (dates && dates[0] && dates[1]) {
                                            setFilters((f) => ({
                                                ...f,
                                                date_from:
                                                    dates[0]!.format(
                                                        "YYYY-MM-DD",
                                                    ),
                                                date_to:
                                                    dates[1]!.format(
                                                        "YYYY-MM-DD",
                                                    ),
                                            }));
                                        } else {
                                            setFilters((f) => {
                                                const {
                                                    date_from,
                                                    date_to,
                                                    ...rest
                                                } = f;
                                                return rest;
                                            });
                                        }
                                    }}
                                />
                            </div>

                            <DataTable
                                columns={columns}
                                dataSource={history?.data ?? []}
                                rowKey="id"
                                loading={isLoading}
                                size="middle"
                                paginationData={{
                                    current_page: history?.current_page ?? 1,
                                    last_page: Math.ceil((history?.total ?? 0) / (history?.per_page ?? 20)),
                                    per_page: history?.per_page ?? 20,
                                    total: history?.total ?? 0,
                                    from: null,
                                    to: null,
                                }}
                                onPageChange={(p) => setPage(p)}
                                emptyState={{ description: "No level history yet" }}
                                scroll={{ x: "max-content" }}
                            />
                        </Card>
                    </motion.div>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MlmLevelHistory;
