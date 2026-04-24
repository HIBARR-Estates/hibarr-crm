import React, { useState, useCallback } from "react";
import {
    Card,
    Table,
    Button,
    Select,
    DatePicker,
    Space,
    Tag,
    Modal,
    Input,
    message,
    Row,
    Col,
    Statistic,
} from "antd";
import { motion } from "framer-motion";
import {
    Download,
    DollarSign,
    CheckCircle,
    RotateCcw,
    Filter,
    CalendarDays,
} from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
    useMlmCommissions,
    useBulkMarkCommissionsPaid,
    useRevertCommission,
    useActiveCycle,
} from "@/Features/Mlm/api";
import {
    CommissionStatusBadge,
    LevelBadge,
    MarkCommissionPaid,
} from "@/Features/Mlm/Components";
import type {
    MlmCommission,
    PaginatedResponse,
    MlmCommissionStatus,
    MlmCommissionType,
} from "@/Features/Mlm/types";
import {
    COMMISSION_STATUS_LABELS,
    COMMISSION_TYPE_LABELS,
} from "@/Features/Mlm/types";
import { formatNumber } from "@/lib/utils";

const { RangePicker } = DatePicker;

interface Props extends PageProps {
    commissions: PaginatedResponse<MlmCommission>;
    summaryStats: {
        total_amount: number;
        pending_amount: number;
        paid_amount: number;
    };
}

const MlmCommissionLedger: React.FC<Props> = ({
    commissions: initialCommissions,
    summaryStats,
}) => {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [revertModalOpen, setRevertModalOpen] = useState(false);
    const [revertId, setRevertId] = useState<number>(0);
    const [revertReason, setRevertReason] = useState("");
    const [markPaidCommission, setMarkPaidCommission] =
        useState<MlmCommission | null>(null);

    const queryParams: Record<string, any> = { page, per_page: 20, ...filters };

    const { data, isLoading, refetch } = useMlmCommissions(queryParams);
    const commissions: PaginatedResponse<MlmCommission> =
        (data as any) ?? initialCommissions;

    const { data: activeCycleData } = useActiveCycle();
    const activeCycle = (activeCycleData as any)?.data?.cycle ?? null;

    const bulkMarkPaid = useBulkMarkCommissionsPaid(() => {
        message.success(`${selectedRows.length} commissions marked as paid`);
        setSelectedRows([]);
        refetch();
    });

    const revertCommission = useRevertCommission(revertId, () => {
        message.success("Commission reverted");
        setRevertModalOpen(false);
        setRevertReason("");
        setRevertId(0);
        refetch();
    });

    const handleExport = () => {
        const params = new URLSearchParams(
            Object.entries(filters).reduce(
                (acc, [k, v]) => {
                    if (v != null && v !== "") acc[k] = String(v);
                    return acc;
                },
                {} as Record<string, string>,
            ),
        );
        window.open(
            `/account/mlm/api/commissions/export?${params.toString()}`,
            "_blank",
        );
    };

    const columns = [
        {
            title: "Deal",
            key: "deal",
            render: (_: any, record: MlmCommission) => (
                <div>
                    <div className="font-medium text-sm">
                        {record.deal?.name ?? `Deal #${record.deal_id}`}
                    </div>
                    {record.deal?.total_value && (
                        <div className="text-xs text-gray-500">
                            Value: ${record.deal.total_value.toLocaleString()}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "Recipient",
            key: "agent",
            render: (_: any, record: MlmCommission) => (
                <span className="font-medium">
                    {record?.type === "system"
                        ? "Organization"
                        : (record.agent?.user?.name ?? "—")}
                </span>
            ),
        },
        {
            title: "Source",
            key: "source",
            render: (_: any, record: MlmCommission) => (
                <span className="text-sm text-gray-600">
                    {record.source_agent?.user?.name ?? "—"}
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
            render: (_: any, record: MlmCommission) =>
                record.level ? <LevelBadge level={record.level} /> : "—",
        },
        {
            title: "Amount",
            key: "amount",
            align: "right" as const,
            sorter: true,
            render: (_: any, record: MlmCommission) => (
                <div className="text-right">
                    <div className="font-semibold text-green-600">
                        ${formatNumber(record.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                        {record.percentage}%
                    </div>
                </div>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (s: MlmCommissionStatus) => (
                <CommissionStatusBadge status={s} />
            ),
        },
        {
            title: "Paid At",
            dataIndex: "paid_at",
            key: "paid_at",
            render: (d: string) => (d ? new Date(d).toLocaleDateString() : "—"),
        },
        {
            title: "Actions",
            key: "actions",
            width: 120,
            render: (_: any, record: MlmCommission) => (
                <Space size="small">
                    {record.status === "pending" && (
                        <Button
                            type="text"
                            size="small"
                            icon={
                                <CheckCircle
                                    size={14}
                                    className="text-green-500"
                                />
                            }
                            onClick={() => setMarkPaidCommission(record)}
                        />
                    )}
                    {record.status === "paid" && (
                        <Button
                            type="text"
                            danger
                            size="small"
                            icon={<RotateCcw size={14} />}
                            onClick={() => {
                                setRevertId(record.id);
                                setRevertModalOpen(true);
                            }}
                        />
                    )}
                </Space>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.mlm.admin.commission_ledger")}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/dashboard" },
                    { name: t("app.mlm.admin.commission_ledger") },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Summary Cards */}
                    <Row gutter={[16, 16]} className="mb-6">
                        <Col xs={12} sm={8}>
                            <Card size="small" className="shadow-sm">
                                <Statistic
                                    title="Total"
                                    value={summaryStats.total_amount}
                                    prefix="$"
                                    precision={2}
                                    valueStyle={{ color: "#16a34a" }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={8}>
                            <Card size="small" className="shadow-sm">
                                <Statistic
                                    title="Pending"
                                    value={summaryStats.pending_amount}
                                    prefix="$"
                                    precision={2}
                                    valueStyle={{ color: "#ea580c" }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={8}>
                            <Card size="small" className="shadow-sm">
                                <Statistic
                                    title="Paid"
                                    value={summaryStats.paid_amount}
                                    prefix="$"
                                    precision={2}
                                    valueStyle={{ color: "#16a34a" }}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {/* Filters */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
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
                                {/* {activeCycle && (
                                    <Button
                                        size="small"
                                        icon={<CalendarDays size={14} />}
                                        type={
                                            filters.date_from ===
                                                activeCycle.start_date &&
                                            filters.date_to ===
                                                activeCycle.end_date
                                                ? "primary"
                                                : "default"
                                        }
                                        onClick={() => {
                                            setFilters((f) => ({
                                                ...f,
                                                date_from:
                                                    activeCycle.start_date,
                                                date_to: activeCycle.end_date,
                                            }));
                                            setPage(1);
                                        }}
                                    >
                                        Cycle #{activeCycle.cycle_number}
                                    </Button>
                                )} */}
                                <div className="flex-1" />

                                {selectedRows.length > 0 && (
                                    <Button
                                        type="primary"
                                        icon={<CheckCircle size={14} />}
                                        onClick={() =>
                                            bulkMarkPaid.mutate({
                                                ids: selectedRows,
                                            })
                                        }
                                        loading={bulkMarkPaid.isPending}
                                    >
                                        Mark {selectedRows.length} Paid
                                    </Button>
                                )}

                                <Button
                                    icon={<Download size={14} />}
                                    onClick={handleExport}
                                >
                                    Export CSV
                                </Button>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Table */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                    >
                        <Card className="shadow-sm">
                            <Table
                                columns={columns}
                                dataSource={commissions?.data ?? []}
                                rowKey="id"
                                loading={isLoading}
                                size="middle"
                                rowSelection={{
                                    selectedRowKeys: selectedRows,
                                    onChange: (keys) =>
                                        setSelectedRows(keys as number[]),
                                    getCheckboxProps: (record) => ({
                                        disabled: record.status !== "pending",
                                    }),
                                }}
                                pagination={{
                                    current: commissions?.current_page ?? 1,
                                    total: commissions?.total ?? 0,
                                    pageSize: commissions?.per_page ?? 20,
                                    showSizeChanger: false,
                                    showTotal: (total, range) =>
                                        `${range[0]}–${range[1]} of ${total}`,
                                    onChange: (p) => setPage(p),
                                }}
                            />
                        </Card>
                    </motion.div>

                    {/* Mark Paid Modal */}
                    <MarkCommissionPaid
                        open={!!markPaidCommission}
                        onClose={() => setMarkPaidCommission(null)}
                        commission={markPaidCommission}
                        handleSuccessCallback={() => {
                            message.success("Commission marked as paid");
                            refetch();
                        }}
                    />

                    {/* Revert Modal */}
                    <Modal
                        title="Revert Commission"
                        open={revertModalOpen}
                        onOk={() =>
                            revertCommission.mutate({ reason: revertReason })
                        }
                        onCancel={() => {
                            setRevertModalOpen(false);
                            setRevertReason("");
                            setRevertId(0);
                        }}
                        confirmLoading={revertCommission.isPending}
                        okText="Revert"
                        okType="danger"
                    >
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Reason for reversal
                            </label>
                            <Input.TextArea
                                rows={3}
                                value={revertReason}
                                onChange={(e) =>
                                    setRevertReason(e.target.value)
                                }
                                placeholder="e.g. Deal was cancelled, duplicate commission..."
                            />
                        </div>
                    </Modal>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MlmCommissionLedger;
