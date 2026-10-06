import { useEffect, useState, type ReactNode } from "react";
import { App } from "antd";
import axios from "axios";
import { router } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import "@/Components/Redesign/redesign.css";
import { REDESIGN_FONT_STACK, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import EntityListHeader from "@/Components/Redesign/primitives/EntityListHeader";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import Icon from "@/Components/Redesign/primitives/Icon";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Pagination from "@/Components/Redesign/primitives/Pagination";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { paymentUiStateLabel } from "@/Components/Redesign/adapters/dealPaymentUiState";
import { useCompanyCurrency } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import usePageRefresh from "@/Hooks/usePageRefresh";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { DealPaymentRequest, DealPaymentUiState } from "@/Types/api/deal-payment";
import PaymentRequestRow, {
    type PaymentRequestListRow,
} from "./components/PaymentRequestRow";
import PaymentRequestsListHeader from "./components/PaymentRequestsListHeader";

interface PaginatedPaymentRequests extends LaravelPaginationMeta {
    data: PaymentRequestListRow[];
}

type StatusTab = "" | DealPaymentUiState;

interface IndexProps extends PageProps {
    pageTitle: string;
    paymentRequests: PaginatedPaymentRequests;
    filters: { ui_state?: string };
    /** Deferred: absent on first paint, filled in right after. */
    counts?: Partial<Record<"all" | DealPaymentUiState, number>>;
}

const UI_STATES: DealPaymentUiState[] = [
    "pending_payment",
    "bank_transfer_pending",
    "processing_online",
    "paid_online",
    "confirmed",
    "failed",
    "invalidated",
];

function apiErrorMessage(error: unknown, fallback: string): string {
    const err = error as {
        response?: { data?: { message?: string; error?: { message?: string } } };
    };
    return (
        err.response?.data?.message ?? err.response?.data?.error?.message ?? fallback
    );
}

/**
 * Deal payment requests across the company, styled after the Meetings
 * workspace: the shared list header with status tabs, a bordered list with
 * its own column heading row, and the redesign pager beneath it.
 */
const Index = ({ paymentRequests, filters, counts }: IndexProps) => {
    const { t } = useTranslation();
    const { td } = useTd();
    const { message } = App.useApp();
    const companyCurrency = useCompanyCurrency();

    // Local copy so a confirm can patch its row in place, no reload.
    const [rows, setRows] = useState<PaymentRequestListRow[]>(paymentRequests.data);
    useEffect(() => setRows(paymentRequests.data), [paymentRequests.data]);

    const [confirmingRow, setConfirmingRow] = useState<PaymentRequestListRow | null>(null);
    const [confirming, setConfirming] = useState(false);

    const activeTab = (filters.ui_state ?? "") as StatusTab;

    const visit = (params: Record<string, unknown>) => {
        router.get(
            route("payment-requests.index"),
            {
                ui_state: activeTab || undefined,
                per_page: paymentRequests.per_page,
                ...params,
            },
            {
                only: ["paymentRequests", "filters"],
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const { refresh, isRefreshing } = usePageRefresh({
        onRefresh: () =>
            new Promise<void>((resolve) => {
                router.reload({
                    only: ["paymentRequests", "counts"],
                    onFinish: () => resolve(),
                });
            }),
    });

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
                message.success(t("pages.payment_requests.confirmed_toast"));
                setConfirmingRow(null);
            } else {
                message.error(
                    response.data?.message ?? t("pages.payment_requests.confirm_failed"),
                );
            }
        } catch (error) {
            message.error(apiErrorMessage(error, t("pages.payment_requests.confirm_failed")));
        } finally {
            setConfirming(false);
        }
    };

    const tabOptions = [
        {
            value: "" as StatusTab,
            label: td("All", { source: "en" }),
            count: counts?.all,
        },
        ...UI_STATES.map((uiState) => ({
            value: uiState as StatusTab,
            label: td(paymentUiStateLabel(uiState), { source: "en" }),
            count: counts?.[uiState],
        })),
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
                    subtitle={t("pages.payment_requests.subtitle", {
                        count: paymentRequests.total.toLocaleString(),
                    })}
                    sticky
                    actions={
                        <button
                            type="button"
                            className="dr-btn dr-btn-ghost"
                            onClick={refresh}
                            disabled={isRefreshing}
                        >
                            <Icon
                                name="refresh"
                                size={13}
                                className={isRefreshing ? "animate-spin" : undefined}
                            />
                            {t("pages.payment_requests.refresh")}
                        </button>
                    }
                    toolbarLeft={
                        <Segmented<StatusTab>
                            value={activeTab}
                            onChange={(tab) => visit({ ui_state: tab || undefined, page: 1 })}
                            ariaLabel={t("pages.payment_requests.filter_label")}
                            options={tabOptions}
                        />
                    }
                />

                <div
                    className="mx-auto w-full max-w-screen-2xl px-6 py-6"
                    style={{ fontFamily: REDESIGN_FONT_STACK }}
                >
                    {rows.length === 0 ? (
                        <>
                            <EmptyState
                                icon="wallet"
                                title={t("pages.payment_requests.empty_title")}
                                description={
                                    activeTab
                                        ? t("pages.payment_requests.empty_filtered")
                                        : t("pages.payment_requests.empty_description")
                                }
                            />
                            {/* An empty page past the first still needs the
                                pager, or there's no way back. */}
                            {paymentRequests.total > 0 && (
                                <Pagination
                                    page={paymentRequests.current_page}
                                    pageSize={paymentRequests.per_page}
                                    totalItems={paymentRequests.total}
                                    onPageChange={(page) => visit({ page })}
                                    onPageSizeChange={(size) => visit({ per_page: size, page: 1 })}
                                    itemLabel="payment request"
                                    itemLabelPlural="payment requests"
                                />
                            )}
                        </>
                    ) : (
                        <>
                            <div
                                style={{
                                    background: T.WHITE,
                                    border: `1px solid ${T.BORDER}`,
                                    // Square at the bottom: the pager sits
                                    // directly beneath and the two read as one.
                                    borderRadius: "10px 10px 0 0",
                                    borderBottom: "none",
                                    overflow: "hidden",
                                }}
                            >
                                <PaymentRequestsListHeader />
                                {rows.map((row) => (
                                    <PaymentRequestRow
                                        key={row.id}
                                        row={row}
                                        companyCurrency={companyCurrency}
                                        onConfirm={() => setConfirmingRow(row)}
                                    />
                                ))}
                            </div>
                            <Pagination
                                page={paymentRequests.current_page}
                                pageSize={paymentRequests.per_page}
                                totalItems={paymentRequests.total}
                                onPageChange={(page) => visit({ page })}
                                onPageSizeChange={(size) => visit({ per_page: size, page: 1 })}
                                itemLabel="payment request"
                                itemLabelPlural="payment requests"
                            />
                        </>
                    )}
                </div>
            </PageLayout>

            <ConfirmDialog
                open={!!confirmingRow}
                title={t("pages.payment_requests.confirm_title")}
                message={t("pages.payment_requests.confirm_message")}
                confirmLabel={t("pages.payment_requests.confirm_yes")}
                cancelLabel={t("pages.payment_requests.cancel")}
                confirmLoading={confirming}
                onConfirm={() => void handleConfirm()}
                onCancel={() => setConfirmingRow(null)}
            />
        </>
    );
};

Index.layout = (page: ReactNode) => <DashboardLayout>{page}</DashboardLayout>;

export default Index;
