import React, { useState } from "react";
import {
    Card,
    Select,
    DatePicker,
    Tag,
    Empty,
    Row,
    Col,
    Statistic,
    Button,
} from "antd";
import { usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { motion } from "framer-motion";
import { DollarSign, Filter, CalendarDays } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import { useMyCommissions, useMyEnrollment } from "@/Features/Mlm/api";
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
import { formatCompanyDate } from "@/lib/companyDateTime";

const { RangePicker } = DatePicker;

interface CommissionSummary {
    total: number;
    pending: number;
    paid: number;
    total_records: number;
}

interface Props extends PageProps {
    summary: CommissionSummary;
}

const MyCommissions: React.FC<Props> = ({
    summary,
}) => {
    const { t } = useTranslation();
    // Commissions are denominated in the app's currency (deal, falling back to
    // company) — never a hardcoded symbol, never the package's price currency.
    const { default_currency_symbol: currencySymbol = "" } = usePage()
        .props as { default_currency_symbol?: string };
    const [page, setPage] = useState(1);
    // Seeded once from the URL so a link from elsewhere (e.g. the personal
    // dashboard's Commission tile) lands here pre-filtered — status=pending,
    // date_from/date_to — rather than on the unfiltered list.
    const [filters, setFilters] = useState<Record<string, any>>(() => {
        const params = new URLSearchParams(window.location.search);
        const seeded: Record<string, any> = {};

        for (const key of ["status", "type", "date_from", "date_to"]) {
            const value = params.get(key);
            if (value) seeded[key] = value;
        }

        return seeded;
    });

    const { data: enrollmentData } = useMyEnrollment();
    const activeCycle = (enrollmentData as any)?.data?.active_cycle ?? null;

    const { data, isLoading } = useMyCommissions({
        page,
        per_page: 20,
        ...filters,
    });

    const commissions: PaginatedResponse<MlmCommission> =
        (data as any) ?? null;

    const records = commissions?.data ?? [];

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
                            Deal value: {currencySymbol}
                            {r.deal.total_value.toLocaleString()}
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
                        {currencySymbol}
                        {r.amount?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                        })}
                    </div>
                    {r.percentage !== null && r.percentage !== undefined ? (
                        <div className="text-xs text-gray-500">
                            {r.percentage}%
                        </div>
                    ) : (
                        // Fixed-fee package leg: show the money, not a fake 0%.
                        <div className="text-xs text-gray-500">
                            {currencySymbol}
                            {r.amount?.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                            })}
                        </div>
                    )}
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
            render: (d: string) => formatCompanyDate(d, "—"),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.mlm.agent.commissions")}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/agent/dashboard" },
                    { name: t("app.mlm.agent.commissions") },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
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
                                        title="Total"
                                        value={summary.total}
                                        prefix={currencySymbol}
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
                                        value={summary.pending}
                                        prefix={currencySymbol}
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
                                        value={summary.total_records}
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
                                    value={filters.status}
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
                                    value={filters.type}
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
                                    allowEmpty={[true, true]}
                                    value={
                                        filters.date_from || filters.date_to
                                            ? [
                                                  filters.date_from
                                                      ? dayjs(filters.date_from)
                                                      : null,
                                                  filters.date_to
                                                      ? dayjs(filters.date_to)
                                                      : null,
                                              ]
                                            : null
                                    }
                                    onChange={(dates) => {
                                        setFilters((f) => {
                                            const {
                                                date_from,
                                                date_to,
                                                ...rest
                                            } = f;

                                            return {
                                                ...rest,
                                                ...(dates?.[0]
                                                    ? {
                                                          date_from:
                                                              dates[0].format(
                                                                  "YYYY-MM-DD",
                                                              ),
                                                      }
                                                    : {}),
                                                ...(dates?.[1]
                                                    ? {
                                                          date_to:
                                                              dates[1].format(
                                                                  "YYYY-MM-DD",
                                                              ),
                                                      }
                                                    : {}),
                                            };
                                        });
                                    }}
                                />
                                {activeCycle && (
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
                                )}
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
                            <DataTable
                                columns={columns}
                                dataSource={records}
                                rowKey="id"
                                loading={isLoading}
                                size="middle"
                                paginationData={{
                                    current_page: commissions?.current_page ?? 1,
                                    last_page: Math.ceil((commissions?.total ?? 0) / (commissions?.per_page ?? 20)),
                                    per_page: commissions?.per_page ?? 20,
                                    total: commissions?.total ?? 0,
                                    from: null,
                                    to: null,
                                }}
                                onPageChange={(p) => setPage(p)}
                                emptyState={{ description: "No commissions yet" }}
                                scroll={{ y: "calc(100vh - 420px)" }}
                            />
                        </Card>
                    </motion.div>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MyCommissions;
