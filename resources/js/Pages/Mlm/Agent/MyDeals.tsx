import React, { useState } from "react";
import {
    Card,
    Tag,
    Empty,
    DatePicker,
    Row,
    Col,
    Statistic,
    Button,
} from "antd";
import { usePage } from "@inertiajs/react";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { motion } from "framer-motion";
import { Briefcase, Filter, CalendarDays } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import { useMyDealContributions, useMyEnrollment } from "@/Features/Mlm/api";
import type { PaginatedResponse } from "@/Features/Mlm/types";
import { formatCompanyDate } from "@/lib/companyDateTime";

const { RangePicker } = DatePicker;

interface DealContribution {
    deal_id: number;
    deal_name: string;
    closed_by: string;
    closed_by_self: boolean;
    deal_value: number;
    commission_amount: number;
    commission_type: string;
    date: string;
}

interface Props extends PageProps {
    contributions: PaginatedResponse<DealContribution>;
}

const MyDeals: React.FC<Props> = ({ contributions: initialContributions }) => {
    const { t } = useTranslation();
    const { default_currency_symbol: currencySymbol = "" } = usePage()
        .props as any;
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<Record<string, any>>({});

    const { data: enrollmentData } = useMyEnrollment();
    const activeCycle = (enrollmentData as any)?.data?.active_cycle ?? null;

    const { data, isLoading } = useMyDealContributions({
        page,
        per_page: 20,
        ...filters,
    });

    const contributions: PaginatedResponse<DealContribution> =
        (data as any) ?? initialContributions;

    const records = contributions?.data ?? [];
    const totalCommission = records.reduce(
        (sum, r) => sum + (r.commission_amount ?? 0),
        0,
    );
    const totalDealValue = records.reduce(
        (sum, r) => sum + (r.deal_value ?? 0),
        0,
    );

    const columns = [
        {
            title: "Deal",
            key: "deal",
            render: (_: any, r: DealContribution) => (
                <div>
                    <div className="font-medium text-sm">{r.deal_name}</div>
                    <div className="text-xs text-gray-500">#{r.deal_id}</div>
                </div>
            ),
        },
        {
            title: "Closed By",
            key: "closed_by",
            render: (_: any, r: DealContribution) => (
                <div className="flex items-center gap-2">
                    <span className="text-sm">{r.closed_by}</span>
                    {r.closed_by_self && (
                        <Tag color="blue" className="text-xs">
                            You
                        </Tag>
                    )}
                </div>
            ),
        },
        {
            title: "Deal Value",
            dataIndex: "deal_value",
            key: "deal_value",
            align: "right" as const,
            render: (val: number) => (
                <span className="font-medium">
                    {currencySymbol}
                    {val?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                    })}
                </span>
            ),
        },
        {
            title: "Your Commission",
            dataIndex: "commission_amount",
            key: "commission_amount",
            align: "right" as const,
            render: (val: number) => (
                <span className="font-semibold text-green-600">
                    {currencySymbol}
                    {val?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                    })}
                </span>
            ),
        },
        {
            title: "Type",
            dataIndex: "commission_type",
            key: "commission_type",
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
                    {t}
                </Tag>
            ),
        },
        {
            title: "Date",
            dataIndex: "date",
            key: "date",
            render: (d: string) => formatCompanyDate(d, "—"),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.mlm.agent.deals")}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/agent/dashboard" },
                    { name: t("app.mlm.agent.deals") },
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
                                        title="Total Deal Value"
                                        value={totalDealValue}
                                        prefix={currencySymbol}
                                        precision={2}
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
                                        title="Your Commission"
                                        value={totalCommission}
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
                                transition={{ duration: 0.3, delay: 0.2 }}
                            >
                                <Card size="small" className="shadow-sm">
                                    <Statistic
                                        title="Total Contributions"
                                        value={contributions?.total ?? 0}
                                    />
                                </Card>
                            </motion.div>
                        </Col>
                    </Row>

                    {/* Filter */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.15 }}
                        className="mb-4"
                    >
                        <Card size="small" className="shadow-sm">
                            <div className="flex flex-wrap gap-3 items-center">
                                <Filter size={16} className="text-gray-400" />
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
                        <Card
                            title={
                                <div className="flex items-center gap-2">
                                    <Briefcase
                                        size={18}
                                        className="text-blue-500"
                                    />
                                    <span className="font-semibold">
                                        Deal Contributions
                                    </span>
                                </div>
                            }
                            className="shadow-sm"
                        >
                            <DataTable
                                columns={columns}
                                dataSource={records}
                                rowKey="deal_id"
                                loading={isLoading}
                                size="middle"
                                paginationData={{
                                    current_page: contributions?.current_page ?? 1,
                                    last_page: Math.ceil((contributions?.total ?? 0) / (contributions?.per_page ?? 20)),
                                    per_page: contributions?.per_page ?? 20,
                                    total: contributions?.total ?? 0,
                                    from: null,
                                    to: null,
                                }}
                                onPageChange={(p) => setPage(p)}
                                emptyState={{ description: "No deal contributions yet" }}
                                scroll={{ y: "calc(100vh - 420px)" }}
                            />
                        </Card>
                    </motion.div>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MyDeals;
