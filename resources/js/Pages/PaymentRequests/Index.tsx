import { useEffect, useState, type ReactNode } from "react";
import { App } from "antd";
import type { TableColumnsType } from "antd";
import axios from "axios";
import { Link, router } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import "@/Components/Redesign/redesign.css";
import { REDESIGN_FONT_STACK } from "@/Components/Redesign/tokens";
import EntityListHeader from "@/Components/Redesign/primitives/EntityListHeader";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import {
    paymentUiStateLabel,
    paymentUiStateBadgeVariant,
} from "@/Components/Redesign/adapters/dealPaymentUiState";
import { formatMoneyAmount } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { DealPaymentRequest, DealPaymentUiState } from "@/Types/api/deal-payment";

interface PaymentRequestRow extends DealPaymentRequest {
    deal: { id: number; name: string | null; url: string } | null;
    agent_name: string | null;
    currency_symbol: string | null;
}

interface PaginatedPaymentRequests extends LaravelPaginationMeta {
    data: PaymentRequestRow[];
}

interface IndexProps extends PageProps {
    pageTitle: string;
    paymentRequests: PaginatedPaymentRequests;
    filters: { ui_state?: string };
}

const UI_STATES: DealPaymentUiState[] = [
    "pending_payment",
    "bank_transfer_pending",
    "processing_online",
    "paid_online",
    "confirmed",
    "failed",
];

function apiErrorMessage(error: unknown, fallback: string): string {
    const err = error as {
        response?: { data?: { message?: string; error?: { message?: string } } };
    };
    return (
        err.response?.data?.message ?? err.response?.data?.error?.message ?? fallback
    );
}

const Index = ({ paymentRequests, filters }: IndexProps) => {
    const { t } = useTranslation();
    const { td } = useTd();
    const { message } = App.useApp();

    const [rows, setRows] = useState<PaymentRequestRow[]>(paymentRequests.data);
    useEffect(() => setRows(paymentRequests.data), [paymentRequests.data]);

    const [confirmingRow, setConfirmingRow] = useState<PaymentRequestRow | null>(null);
    const [confirming, setConfirming] = useState(false);

    const handleFilterChange = (uiState: string) => {
        router.get(
            route("payment-requests.index"),
            { ui_state: uiState || undefined, page: 1 },
            { only: ["paymentRequests", "filters"], preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const handlePageChange = (page: number) => {
        router.get(
            route("payment-requests.index"),
            { ui_state: filters.ui_state, page, per_page: paymentRequests.per_page },
            { only: ["paymentRequests"], preserveState: true, preserveScroll: true },
        );
    };

    const handleConfirm = async () => {
        if (!confirmingRow) return;
        setConfirming(true);
        try {
            const response = await axios.post(
                route("deals.payment-request.confirm", confirmingRow.deal_id),
            );
            if (response.data?.status === "success" && response.data.data) {
                const updated = response.data.data as DealPaymentRequest;
                setRows((prev) =>
                    prev.map((r) => (r.id === confirmingRow.id ? { ...r, ...updated } : r)),
                );
                message.success(td("Bank transfer confirmed.", { source: "en" }));
                setConfirmingRow(null);
            } else {
                message.error(
                    response.data?.message ?? td("Unable to confirm transfer.", { source: "en" }),
                );
            }
        } catch (error) {
            message.error(apiErrorMessage(error, td("Unable to confirm transfer.", { source: "en" })));
        } finally {
            setConfirming(false);
        }
    };

    const columns: TableColumnsType<PaymentRequestRow> = [
        {
            title: td("Deal", { source: "en" }),
            key: "deal",
            render: (_, record) =>
                record.deal ? (
                    <Link href={record.deal.url} className="font-medium">
                        {record.deal.name}
                    </Link>
                ) : (
                    <span className="text-gray-400">—</span>
                ),
        },
        {
            title: td("Amount", { source: "en" }),
            key: "amount",
            render: (_, record) =>
                formatMoneyAmount(record.amount, {
                    code: record.currency ?? "",
                    symbol: record.currency_symbol || record.currency || "",
                }),
        },
        {
            title: td("Status", { source: "en" }),
            key: "status",
            render: (_, record) => (
                <Badge variant={paymentUiStateBadgeVariant(record.ui_state)}>
                    {td(paymentUiStateLabel(record.ui_state), { source: "en" })}
                </Badge>
            ),
        },
        {
            title: td("Method", { source: "en" }),
            key: "gateway",
            render: (_, record) => record.gateway ?? <span className="text-gray-400">—</span>,
        },
        {
            title: td("Agent", { source: "en" }),
            key: "agent",
            render: (_, record) => record.agent_name ?? <span className="text-gray-400">—</span>,
        },
        {
            title: td("Created", { source: "en" }),
            key: "created_at",
            render: (_, record) =>
                record.created_at ? formatCompanyDateTime(record.created_at) : "—",
        },
        {
            title: td("Updated", { source: "en" }),
            key: "updated_at",
            render: (_, record) =>
                record.updated_at ? formatCompanyDateTime(record.updated_at) : "—",
        },
        {
            title: td("Actions", { source: "en" }),
            key: "actions",
            render: (_, record) => (
                <div className="flex items-center gap-2">
                    {record.proof_url && (
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<Icon name="file-text" size={12} />}
                            onClick={() => window.open(record.proof_url!, "_blank", "noreferrer")}
                        >
                            {td("Proof", { source: "en" })}
                        </Button>
                    )}
                    {record.show_checkout_url && record.checkout_url && (
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<Icon name="external-link" size={12} />}
                            onClick={() => window.open(record.checkout_url!, "_blank", "noreferrer")}
                        >
                            {td("Checkout", { source: "en" })}
                        </Button>
                    )}
                    {record.can_confirm && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setConfirmingRow(record)}
                        >
                            {td("Confirm transfer", { source: "en" })}
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            <PageLayout
                title={t("app.menu.payment_requests")}
                breadcrumbs={[{ name: t("app.menu.payment_requests") }]}
                mainContentClassName="p-0"
            >
                <EntityListHeader
                    title={t("app.menu.payment_requests")}
                    subtitle={`${paymentRequests.total.toLocaleString()} ${td("payment requests", { source: "en" })}`}
                    toolbarLeft={
                        <Segmented
                            value={filters.ui_state ?? ""}
                            onChange={handleFilterChange}
                            options={[
                                { value: "", label: td("All", { source: "en" }) },
                                ...UI_STATES.map((uiState) => ({
                                    value: uiState,
                                    label: td(paymentUiStateLabel(uiState), { source: "en" }),
                                })),
                            ]}
                        />
                    }
                />

                <div
                    className="max-w-screen-2xl mx-auto space-y-4 px-6 py-6"
                    style={{ fontFamily: REDESIGN_FONT_STACK }}
                >
                    <DataTable<PaymentRequestRow>
                        columns={columns}
                        dataSource={rows}
                        rowKey="id"
                        containerClassName="payment-requests-table"
                        paginationData={{
                            current_page: paymentRequests.current_page,
                            last_page: paymentRequests.last_page,
                            per_page: paymentRequests.per_page,
                            total: paymentRequests.total,
                            from: paymentRequests.from,
                            to: paymentRequests.to,
                        }}
                        onPageChange={handlePageChange}
                        emptyState={{
                            title: td("No payment requests", { source: "en" }),
                            description: td(
                                "Deal payment requests will appear here once created.",
                                { source: "en" },
                            ),
                        }}
                        scroll={{ x: "max-content", y: "calc(100vh - 280px)" }}
                        size="small"
                    />
                </div>
            </PageLayout>

            <ConfirmDialog
                open={!!confirmingRow}
                title={td("Confirm bank transfer?", { source: "en" })}
                message={td(
                    "Confirm that the customer's bank transfer proof has been reviewed and approved.",
                    { source: "en" },
                )}
                confirmLabel={td("Yes, confirm", { source: "en" })}
                cancelLabel={td("Cancel", { source: "en" })}
                confirmLoading={confirming}
                onConfirm={() => void handleConfirm()}
                onCancel={() => setConfirmingRow(null)}
            />
        </>
    );
};

Index.layout = (page: ReactNode) => <DashboardLayout>{page}</DashboardLayout>;

export default Index;
