import { useEffect, useRef, useState, type ReactNode } from "react";
import { App } from "antd";
import axios from "axios";
import { router } from "@inertiajs/react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import "@/Components/Redesign/redesign.css";
import { REDESIGN_FONT_STACK, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import EntityListHeader from "@/Components/Redesign/primitives/EntityListHeader";
import Icon from "@/Components/Redesign/primitives/Icon";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Pagination from "@/Components/Redesign/primitives/Pagination";
import PaymentRequestDetailModal from "@/Components/Redesign/payment/PaymentRequestDetailModal";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { paymentUiStateLabel } from "@/Components/Redesign/adapters/dealPaymentUiState";
import {
    canCancelPaymentRequest,
    isCheckoutLinkExpired,
} from "@/Pages/Deals/Redesign/adapters/mapDealPaymentUiState";
import { formatMoneyAmount, useCompanyCurrency } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import usePageRefresh from "@/Hooks/usePageRefresh";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { formatCompanyDate } from "@/lib/companyDateTime";
import type { DealPaymentRequest, DealPaymentUiState } from "@/Types/api/deal-payment";
import PaymentRequestFiltersModal, {
    type PaymentRequestFilterOptions,
    type PaymentRequestSlice,
} from "./components/PaymentRequestFiltersModal";
import PaymentRequestRow, {
    PAYMENT_REQUEST_GRID,
    type PaymentRequestListRow,
} from "./components/PaymentRequestRow";
import PaymentRequestsListHeader from "./components/PaymentRequestsListHeader";

interface PaginatedPaymentRequests extends LaravelPaginationMeta {
    data: PaymentRequestListRow[];
}

interface PaymentRequestStats {
    currency: string | null;
    currency_symbol: string | null;
    count: number;
    requested: number;
    collected: number;
    outstanding: number;
    cancelled: number;
}

interface ListFilters {
    ui_state?: string | null;
    date_from?: string | null;
    date_to?: string | null;
    search?: string | null;
    lead_id?: number[] | null;
    agent_id?: number[] | null;
    currency_id?: number[] | null;
}

type StatusTab = "" | DealPaymentUiState;

interface IndexProps extends PageProps {
    pageTitle: string;
    paymentRequests: PaginatedPaymentRequests;
    filters: ListFilters;
    /** Deferred: absent on first paint, filled in right after. */
    counts?: Partial<Record<"all" | DealPaymentUiState, number>>;
    /** Deferred with the counts. Totals for the date range, search, lead, agent, and currency — not the status tab. */
    stats?: PaymentRequestStats;
    /** Deferred. Leads, agents, and currencies that appear on a payment request. */
    filterOptions?: PaymentRequestFilterOptions;
}

function apiErrorMessage(error: unknown, fallback: string): string {
    const err = error as {
        response?: { data?: { message?: string; error?: { message?: string } } };
    };
    return (
        err.response?.data?.message ?? err.response?.data?.error?.message ?? fallback
    );
}

/**
 * Same card as the personal dashboard stat strip: a label, the figure with
 * its window beside it, and one line of what the figure includes.
 */
function StatCard({
    label,
    value,
    period,
    note,
}: {
    label: string;
    value: string;
    period: string;
    note: string;
}) {
    return (
        <div
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                padding: "13px 15px",
                minWidth: 0,
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    fontSize: 12.5,
                    color: T.TEXT_MUTED,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {label}
            </div>
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 9,
                    marginTop: 6,
                    flexWrap: "wrap",
                }}
            >
                <span
                    style={{
                        fontSize: 24,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                        color: T.NAVY,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {value}
                </span>
                <span style={{ fontSize: 12, color: T.TEXT_HINT }}>{period}</span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: T.TEXT_MUTED }}>{note}</p>
        </div>
    );
}

function StatCardSkeleton({ label }: { label: string }) {
    return (
        <div
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                padding: "13px 15px",
                minWidth: 0,
                boxSizing: "border-box",
            }}
        >
            <span style={{ fontSize: 12.5, color: T.TEXT_MUTED, whiteSpace: "nowrap" }}>{label}</span>
            <div
                aria-hidden
                className="dr-skeleton"
                style={{ height: 24, width: "58%", borderRadius: 6, marginTop: 9 }}
            />
            <div
                aria-hidden
                className="dr-skeleton"
                style={{ height: 12, width: "80%", borderRadius: 6, marginTop: 12 }}
            />
        </div>
    );
}

/**
 * Deal payment requests across the company. Status and date live in the
 * filter workbench, with the lead, agent, and currency. Search sits on the
 * toolbar. The date range, search, lead, agent, and currency narrow the
 * accountant totals. Status narrows only the list.
 */
const Index = ({ paymentRequests, filters, counts, stats, filterOptions }: IndexProps) => {
    const { t } = useTranslation();
    const { td } = useTd();
    const { message } = App.useApp();
    const companyCurrency = useCompanyCurrency();

    const [rows, setRows] = useState<PaymentRequestListRow[]>(paymentRequests.data);
    useEffect(() => setRows(paymentRequests.data), [paymentRequests.data]);

    const [confirmingRow, setConfirmingRow] = useState<PaymentRequestListRow | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [retryingRow, setRetryingRow] = useState<PaymentRequestListRow | null>(null);
    const [retrying, setRetrying] = useState(false);

    const [filtersOpen, setFiltersOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState(filters.search ?? "");

    const activeTab = (filters.ui_state ?? "") as StatusTab;
    const selected = rows.find((row) => row.id === selectedId) ?? null;
    const searchFromServer = filters.search ?? "";
    const leadIds = filters.lead_id ?? [];
    const agentIds = filters.agent_id ?? [];
    const currencyIds = filters.currency_id ?? [];
    const hasSlice = Boolean(
        activeTab || filters.date_from || filters.date_to || leadIds.length || agentIds.length || currencyIds.length,
    );
    const listFiltered = Boolean(hasSlice || searchFromServer);

    const searchField = useRef(false);
    const searchEdited = useRef(false);

    const visit = (params: Record<string, unknown>) => {
        router.get(
            route("payment-requests.index"),
            {
                ui_state: activeTab || undefined,
                date_from: filters.date_from || undefined,
                date_to: filters.date_to || undefined,
                search: filters.search || undefined,
                lead_id: leadIds.length ? leadIds : undefined,
                agent_id: agentIds.length ? agentIds : undefined,
                currency_id: currencyIds.length ? currencyIds : undefined,
                per_page: paymentRequests.per_page,
                ...params,
            },
            {
                only: ["paymentRequests", "filters", "counts", "stats"],
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    useEffect(() => {
        if (searchField.current) return;
        setSearchQuery(searchFromServer);
    }, [searchFromServer]);

    useEffect(() => {
        if (!searchEdited.current) return;
        const next = searchQuery.trim();
        if (next === searchFromServer.trim()) return;
        const timer = window.setTimeout(() => {
            visit({ search: next || undefined, page: 1 });
        }, 300);
        return () => window.clearTimeout(timer);
        // visit is recreated each render and already closes over the latest
        // status and dates. Re-running this when those change would search again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, searchFromServer]);

    const applySlice = (next: PaymentRequestSlice) => {
        setFiltersOpen(false);
        visit({
            ui_state: next.uiState || undefined,
            date_from: next.dateFrom || undefined,
            date_to: next.dateTo || undefined,
            lead_id: next.leadIds.length ? next.leadIds : undefined,
            agent_id: next.agentIds.length ? next.agentIds : undefined,
            currency_id: next.currencyIds.length ? next.currencyIds : undefined,
            page: 1,
        });
    };

    const clearSlice = () =>
        applySlice({ uiState: "", dateFrom: "", dateTo: "", leadIds: [], agentIds: [], currencyIds: [] });

    const { refresh, isRefreshing } = usePageRefresh({
        onRefresh: () =>
            new Promise<void>((resolve) => {
                router.reload({
                    only: ["paymentRequests", "counts", "stats"],
                    onFinish: () => resolve(),
                });
            }),
    });

    const patchRow = (updated: DealPaymentRequest) => {
        setRows((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
    };

    const handleConfirm = async () => {
        if (!confirmingRow) return;
        setConfirming(true);
        try {
            const response = await axios.post(
                route("deals.payment-request.confirm", confirmingRow.deal_id),
            );
            if (response.data?.status === "success" && response.data.data) {
                patchRow(response.data.data as DealPaymentRequest);
                message.success(
                    confirmingRow.ui_state === "cash_pending"
                        ? t("pages.payment_requests.confirmed_cash_toast")
                        : t("pages.payment_requests.confirmed_toast"),
                );
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

    const handleCancel = async () => {
        if (!selected) return;
        setCancelling(true);
        try {
            const response = await axios.post(
                route("deals.payment-request.cancel", selected.deal_id),
            );
            if (response.data?.status === "success" && response.data.data) {
                patchRow(response.data.data as DealPaymentRequest);
                message.success(t("pages.deals.payment_request.cancelled_toast"));
                setCancelOpen(false);
            } else {
                message.error(
                    response.data?.message ?? t("pages.deals.payment_request.cancel_failed"),
                );
            }
        } catch (error) {
            message.error(apiErrorMessage(error, t("pages.deals.payment_request.cancel_failed")));
        } finally {
            setCancelling(false);
        }
    };

    const handleRetry = async () => {
        if (!retryingRow) return;
        setRetrying(true);
        try {
            const response = await axios.post(
                route("deals.payment-requests.retry", {
                    deal: retryingRow.deal_id,
                    payment: retryingRow.id,
                }),
            );
            if (response.data?.status === "success") {
                message.success(t("pages.deals.payment_request.retry_toast"));
                setRetryingRow(null);
                setSelectedId(null);
                visit({ page: 1 });
            } else {
                message.error(response.data?.message ?? t("pages.deals.payment_request.retry_failed"));
            }
        } catch (error) {
            message.error(apiErrorMessage(error, t("pages.deals.payment_request.retry_failed")));
        } finally {
            setRetrying(false);
        }
    };

    const statusLabel = activeTab
        ? td(paymentUiStateLabel(activeTab), { source: "en" })
        : null;

    const selectionNote = (
        ids: number[],
        choices: { value: number; label: string }[] | undefined,
        countKey: string,
    ) => {
        if (ids.length === 0) return null;
        if (ids.length === 1) {
            return choices?.find((choice) => choice.value === ids[0])?.label ?? `#${ids[0]}`;
        }
        return t(countKey, { count: ids.length });
    };

    const sliceCount =
        (activeTab ? 1 : 0)
        + (filters.date_from || filters.date_to ? 1 : 0)
        + (leadIds.length ? 1 : 0)
        + (agentIds.length ? 1 : 0)
        + (currencyIds.length ? 1 : 0);

    const sliceSentence = [
        statusLabel,
        filters.date_from || filters.date_to
            ? [filters.date_from, filters.date_to]
                  .filter(Boolean)
                  .map((value) => formatCompanyDate(value as string))
                  .join(" – ")
            : null,
        selectionNote(leadIds, filterOptions?.leads, "pages.payment_requests.filter_leads_count"),
        selectionNote(agentIds, filterOptions?.agents, "pages.payment_requests.filter_agents_count"),
        selectionNote(currencyIds, filterOptions?.currencies, "pages.payment_requests.filter_currencies_count"),
    ]
        .filter(Boolean)
        .join(" · ");

    const money = (amount: number) =>
        formatMoneyAmount(amount, {
            code: stats?.currency ?? companyCurrency.code,
            symbol: stats?.currency_symbol || stats?.currency || companyCurrency.symbol,
        });

    const fromLabel = filters.date_from ? formatCompanyDate(filters.date_from) : null;
    const toLabel = filters.date_to ? formatCompanyDate(filters.date_to) : null;
    const period =
        fromLabel && toLabel
            ? t("pages.payment_requests.stats_range_between", { from: fromLabel, to: toLabel })
            : fromLabel
              ? t("pages.payment_requests.stats_range_from", { from: fromLabel })
              : toLabel
                ? t("pages.payment_requests.stats_range_to", { to: toLabel })
                : t("pages.payment_requests.stats_range_all");

    const searchScope = filters.search?.trim()
        ? t("pages.payment_requests.stats_note_search", { search: filters.search.trim() })
        : null;
    const filterScope = [
        searchScope,
        selectionNote(leadIds, filterOptions?.leads, "pages.payment_requests.filter_leads_count"),
        selectionNote(agentIds, filterOptions?.agents, "pages.payment_requests.filter_agents_count"),
        selectionNote(currencyIds, filterOptions?.currencies, "pages.payment_requests.filter_currencies_count"),
    ]
        .filter(Boolean)
        .join(" · ");
    const scopeNote = (definition: string) =>
        filterScope ? `${definition} · ${filterScope}` : definition;

    const statCards = [
        {
            key: "count",
            label: t("pages.payment_requests.stats_count"),
            value: stats ? stats.count.toLocaleString() : null,
            note: scopeNote(t("pages.payment_requests.stats_note_count")),
        },
        {
            key: "requested",
            label: t("pages.payment_requests.stats_requested"),
            value: stats ? money(stats.requested) : null,
            note: scopeNote(t("pages.payment_requests.stats_note_requested")),
        },
        {
            key: "collected",
            label: t("pages.payment_requests.stats_collected"),
            value: stats ? money(stats.collected) : null,
            note: scopeNote(t("pages.payment_requests.stats_note_collected")),
        },
        {
            key: "outstanding",
            label: t("pages.payment_requests.stats_outstanding"),
            value: stats ? money(stats.outstanding) : null,
            note: scopeNote(t("pages.payment_requests.stats_note_outstanding")),
        },
        {
            key: "cancelled",
            label: t("pages.payment_requests.stats_cancelled"),
            value: stats ? money(stats.cancelled) : null,
            note: scopeNote(t("pages.payment_requests.stats_note_cancelled")),
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
                    subtitle={t("pages.payment_requests.subtitle", {
                        count: paymentRequests.total.toLocaleString(),
                    })}
                    sticky
                    actions={
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={refresh}
                            disabled={isRefreshing}
                            icon={
                                <Icon
                                    name="refresh"
                                    size={13}
                                    className={isRefreshing ? "animate-spin" : undefined}
                                />
                            }
                        >
                            {t("pages.payment_requests.refresh")}
                        </Button>
                    }
                    filtersCount={sliceCount}
                    onOpenFilters={() => setFiltersOpen(true)}
                    filtersLabel={t("app.filter")}
                    toolbarLeft={
                        <label className="relative block min-w-0" style={{ width: 380, maxWidth: "100%" }}>
                            <span
                                className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2"
                                style={{ color: T.TEXT_HINT }}
                            >
                                <Icon name="search" size={14} />
                            </span>
                            <input
                                type="search"
                                className="dr-input"
                                value={searchQuery}
                                placeholder={t("pages.payment_requests.filter_search_placeholder")}
                                aria-label={t("pages.payment_requests.filter_search")}
                                onFocus={() => {
                                    searchField.current = true;
                                }}
                                onBlur={() => {
                                    searchField.current = false;
                                }}
                                onChange={(event) => {
                                    searchEdited.current = true;
                                    setSearchQuery(event.target.value);
                                }}
                                style={{ height: 36, paddingLeft: 34 }}
                            />
                        </label>
                    }
                    filterSentence={
                        hasSlice ? (
                            <div className="flex flex-wrap items-center gap-2 py-2 text-sm text-dr-text">
                                <span>{sliceSentence}</span>
                                <Button variant="ghost" size="sm" onClick={clearSlice}>
                                    {t("pages.payment_requests.filter_clear")}
                                </Button>
                            </div>
                        ) : undefined
                    }
                />

                <div
                    className="mx-auto w-full max-w-screen-2xl px-6 py-6"
                    style={{ fontFamily: REDESIGN_FONT_STACK }}
                >
                    <div
                        className="mb-4"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {statCards.map((card) =>
                            card.value != null ? (
                                <StatCard
                                    key={card.key}
                                    label={card.label}
                                    value={card.value}
                                    period={period}
                                    note={card.note}
                                />
                            ) : (
                                <StatCardSkeleton key={card.key} label={card.label} />
                            ),
                        )}
                    </div>

                    {rows.length === 0 ? (
                        <>
                            <EmptyState
                                icon="wallet"
                                title={t("pages.payment_requests.empty_title")}
                                description={
                                    listFiltered
                                        ? t("pages.payment_requests.empty_filtered")
                                        : t("pages.payment_requests.empty_description")
                                }
                            />
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
                                    display: "grid",
                                    gridTemplateColumns: PAYMENT_REQUEST_GRID,
                                    columnGap: 16,
                                    background: T.WHITE,
                                    border: `1px solid ${T.BORDER}`,
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
                                        onOpen={() => setSelectedId(row.id)}
                                        onRetry={() => setRetryingRow(row)}
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

            <PaymentRequestDetailModal
                request={selected}
                open={selected != null && !cancelOpen}
                onClose={() => setSelectedId(null)}
                companyCurrency={companyCurrency}
                onCancel={
                    selected && canCancelPaymentRequest(selected.ui_state)
                        ? () => setCancelOpen(true)
                        : undefined
                }
                onConfirm={
                    selected?.can_confirm ? () => setConfirmingRow(selected) : undefined
                }
                onRetry={
                    selected && isCheckoutLinkExpired(selected)
                        ? () => setRetryingRow(selected)
                        : undefined
                }
            />

            <PaymentRequestFiltersModal
                open={filtersOpen}
                value={{
                    uiState: filters.ui_state ?? "",
                    dateFrom: filters.date_from ?? "",
                    dateTo: filters.date_to ?? "",
                    leadIds,
                    agentIds,
                    currencyIds,
                }}
                counts={counts}
                options={filterOptions}
                onClose={() => setFiltersOpen(false)}
                onApply={applySlice}
            />

            <ConfirmDialog
                open={!!confirmingRow}
                zIndex={1400}
                title={
                    confirmingRow?.ui_state === "cash_pending"
                        ? t("pages.payment_requests.confirm_cash_title")
                        : t("pages.payment_requests.confirm_title")
                }
                message={
                    confirmingRow?.ui_state === "cash_pending"
                        ? t("pages.payment_requests.confirm_cash_message")
                        : t("pages.payment_requests.confirm_message")
                }
                confirmLabel={t("pages.payment_requests.confirm_yes")}
                cancelLabel={t("pages.payment_requests.cancel")}
                confirmLoading={confirming}
                onConfirm={() => void handleConfirm()}
                onCancel={() => setConfirmingRow(null)}
            />

            <ConfirmDialog
                open={!!retryingRow}
                zIndex={1400}
                title={t("pages.deals.payment_request.retry_title")}
                message={t("pages.deals.payment_request.retry_message")}
                confirmLabel={t("pages.deals.payment_request.retry_confirm")}
                cancelLabel={t("pages.deals.payment_request.cancel")}
                confirmLoading={retrying}
                onConfirm={() => void handleRetry()}
                onCancel={() => setRetryingRow(null)}
            />

            <ConfirmDialog
                open={cancelOpen}
                zIndex={1400}
                danger
                title={t("pages.deals.payment_request.cancel_title")}
                message={t("pages.deals.payment_request.cancel_message")}
                confirmLabel={t("pages.deals.payment_request.cancel_confirm")}
                cancelLabel={t("pages.deals.payment_request.cancel")}
                confirmLoading={cancelling}
                onConfirm={() => void handleCancel()}
                onCancel={() => setCancelOpen(false)}
            />
        </>
    );
};

Index.layout = (page: ReactNode) => <DashboardLayout>{page}</DashboardLayout>;

export default Index;
