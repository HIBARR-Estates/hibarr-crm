import React, { useState } from "react";
import {
    Card,
    Table,
    Select,
    DatePicker,
    Tag,
    Empty,
    Row,
    Col,
    Statistic,
} from "antd";
import { motion } from "framer-motion";
import { DollarSign, Filter } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useMyCommissions } from "@/Features/Mlm/api";
import { CommissionStatusBadge, LevelBadge } from "@/Features/Mlm/Components";
import type {
    MlmCommission,
    PaginatedResponse,
    MlmCommissionType,
} from "@/Features/Mlm/types";
import {
    COMMISSION_STATUS_LABELS,
    COMMISSION_TYPE_LABELS,
} from "@/Features/Mlm/types";

const { RangePicker } = DatePicker;

interface Props extends PageProps {
    commissions: PaginatedResponse<MlmCommission>;
}

const MyCommissions: React.FC<Props> = ({
    commissions: initialCommissions,
}) => {
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<Record<string, any>>({});

    const { data, isLoading } = useMyCommissions({
        page,
        per_page: 20,
        ...filters,
    });

    const commissions: PaginatedResponse<MlmCommission> =
        (data as any)?.data ?? initialCommissions;

    const records = commissions?.data ?? [];
    const totalEarned = records.reduce(
        (sum, c) => sum + (c.status !== "reverted" ? c.amount : 0),
        0,
    );
    const pendingAmount = records
        .filter((c) => c.status === "pending")
        .reduce((sum, c) => sum + c.amount, 0);

    const columns = [
        {
            title: "Deal",
            key: "deal",
            render: (_: any, r: MlmCommission) => (
                <div>
                    <div className="font-medium text-sm">
                        {r.deal?.name ?? `Deal #${r.deal_id}`}
                    </div>
                    {r.deal?.total_value != null && (
                        <div className="text-xs text-gray-500">
                            Deal value: ${r.deal.total_value.toLocaleString()}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "Source Agent",
            key: "source",
            render: (_: any, r: MlmCommission) => (
                <span className="text-sm">
                    {r.source_agent?.user?.name ?? "Direct"}
                </span>
            ),
        },
        {
            title: "Type",
            dataIndex: "type",
            key: "type",
            render: (t: MlmCommissionType) => (
                <Tag
                    color={
                        t === "agent"
                            ? "blue"
                            : t === "upline"
                              ? "purple"
                              : "default"
                    }
                >
                    {COMMISSION_TYPE_LABELS[t] ?? t}
                </Tag>
            ),
        },
        {
            title: "Level",
            key: "level",
            render: (_: any, r: MlmCommission) =>
                r.level ? <LevelBadge level={r.level} /> : "—",
        },
        {
            title: "Amount",
            key: "amount",
            align: "right" as const,
            render: (_: any, r: MlmCommission) => (
                <div className="text-right">
                    <div className="font-semibold text-green-600">
                        $
                        {r.amount?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                        })}
                    </div>
                    <div className="text-xs text-gray-500">{r.percentage}%</div>
                </div>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (s: any) => <CommissionStatusBadge status={s} />,
        },
        {
            title: "Date",
            dataIndex: "created_at",
            key: "created_at",
            render: (d: string) => (d ? new Date(d).toLocaleDateString() : "—"),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title="My Commissions"
                breadcrumbs={[{ name: "MLM" }, { name: "My Commissions" }]}
            >
                {/* Summary */}
                <Row gutter={[16, 16]} className="mb-6">
                    <Col xs={12} sm={8}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card size="small" className="shadow-sm">
                                <Statistic
                                    title="Page Total"
                                    value={totalEarned}
                                    prefix="$"
                                    precision={2}
                                    valueStyle={{ color: "#16a34a" }}
                                />
                            </Card>
                        </motion.div>
                    </Col>
                    <Col xs={12} sm={8}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                        >
                            <Card size="small" className="shadow-sm">
                                <Statistic
                                    title="Pending"
                                    value={pendingAmount}
                                    prefix="$"
                                    precision={2}
                                    valueStyle={{ color: "#ea580c" }}
                                />
                            </Card>
                        </motion.div>
                    </Col>
                    <Col xs={12} sm={8}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.2 }}
                        >
                            <Card size="small" className="shadow-sm">
                                <Statistic
                                    title="Total Records"
                                    value={commissions?.total ?? 0}
                                />
                            </Card>
                        </motion.div>
                    </Col>
                </Row>

                {/* Filters */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                    className="mb-4"
                >
                    <Card size="small" className="shadow-sm">
                        <div className="flex flex-wrap gap-3 items-center">
                            <Filter size={16} className="text-gray-400" />
                            <Select
                                placeholder="Status"
                                allowClear
                                className="w-36"
                                options={Object.entries(
                                    COMMISSION_STATUS_LABELS,
                                ).map(([v, l]) => ({ value: v, label: l }))}
                                onChange={(v) =>
                                    setFilters((f) => ({
                                        ...f,
                                        status: v,
                                    }))
                                }
                            />
                            <Select
                                placeholder="Type"
                                allowClear
                                className="w-36"
                                options={Object.entries(
                                    COMMISSION_TYPE_LABELS,
                                ).map(([v, l]) => ({ value: v, label: l }))}
                                onChange={(v) =>
                                    setFilters((f) => ({
                                        ...f,
                                        type: v,
                                    }))
                                }
                            />
                            <RangePicker
                                onChange={(dates) => {
                                    if (dates && dates[0] && dates[1]) {
                                        setFilters((f) => ({
                                            ...f,
                                            date_from:
                                                dates[0]!.format("YYYY-MM-DD"),
                                            date_to:
                                                dates[1]!.format("YYYY-MM-DD"),
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
                    </Card>
                </motion.div>

                {/* Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                >
                    <Card className="shadow-sm">
                        <Table
                            columns={columns}
                            dataSource={records}
                            rowKey="id"
                            loading={isLoading}
                            size="middle"
                            pagination={{
                                current: commissions?.current_page ?? 1,
                                total: commissions?.total ?? 0,
                                pageSize: commissions?.per_page ?? 20,
                                showSizeChanger: false,
                                showTotal: (total, range) =>
                                    `${range[0]}–${range[1]} of ${total}`,
                                onChange: (p) => setPage(p),
                            }}
                            locale={{
                                emptyText: (
                                    <Empty description="No commissions yet" />
                                ),
                            }}
                        />
                    </Card>
                </motion.div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MyCommissions;
