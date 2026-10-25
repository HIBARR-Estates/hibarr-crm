import React, { useEffect, useState } from "react";
import { Deferred } from "@inertiajs/react";
import { ReloadOutlined } from "@ant-design/icons";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Pagination from "@/Components/Redesign/primitives/Pagination";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import "@/Components/Redesign/redesign.css";

import AuditLogFilterBar from "./components/AuditLogFilterBar";
import AuditLogRow, { AUDIT_ROW_COLS, AUDIT_ROW_GRID } from "./components/AuditLogRow";
import useAuditLogFilters from "./hooks/useAuditLogFilters";
import useAuditLogEntries from "./hooks/useAuditLogEntries";
import type { AuditEvent, AuditLogFilterOptions, AuditSource } from "./types";

interface AuditLogPageProps {
    pageTitle: string;
    events: AuditEvent[];
    sources: AuditSource[];
    /** Deferred: users and record types that appear in the log. */
    filterOptions?: AuditLogFilterOptions;
}

function RowSkeleton() {
    return (
        <div
            className={`${AUDIT_ROW_GRID} py-3 border-b last:border-b-0 animate-pulse`}
            style={{ ...AUDIT_ROW_COLS, borderColor: "#f4f5f7" }}
        >
            {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-3.5 rounded" style={{ background: "#eef1f5", width: i === 6 ? 14 : "80%" }} />
            ))}
        </div>
    );
}

/** Debounces free-text search so typing doesn't fire a request per key. */
function useDebounced<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

export default function AuditLogIndex({ pageTitle, events, sources, filterOptions }: AuditLogPageProps) {
    const { t } = useTranslation();
    const { filters, update, setPage, reset, activeCount } = useAuditLogFilters();
    const [refreshKey, setRefreshKey] = useState(0);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const search = useDebounced(filters.search);
    const recordId = useDebounced(filters.recordId);

    const { entries, meta, loading, error } = useAuditLogEntries({ ...filters, recordId }, search, refreshKey);

    const filterBar = (options?: AuditLogFilterOptions) => (
        <AuditLogFilterBar
            filters={filters}
            onChange={update}
            onReset={reset}
            activeCount={activeCount}
            events={events}
            sources={sources}
            options={options}
        />
    );

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: t("app.menu.settings"), url: route("settings-overview.index") },
                { name: pageTitle },
            ]}
        >
            <div className="max-w-[1320px] mx-auto w-full">
                <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
                    <div>
                        <h1 className="m-0 font-bold" style={{ fontSize: 19, color: T.NAVY }}>
                            {pageTitle}
                        </h1>
                        <p className="mt-1 mb-0" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                            {t("app.auditLog.subtitle")}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        icon={<ReloadOutlined />}
                        onClick={() => setRefreshKey((k) => k + 1)}
                        loading={loading}
                    >
                        {t("app.auditLog.refresh")}
                    </Button>
                </div>

                <Deferred data="filterOptions" fallback={filterBar(undefined)}>
                    {filterBar(filterOptions)}
                </Deferred>

                <div className="rounded-[10px] border bg-white overflow-hidden" style={{ borderColor: T.BORDER }}>
                    <div className="overflow-x-auto">
                        <div
                            className={`${AUDIT_ROW_GRID} py-2.5 border-b`}
                            style={{
                                ...AUDIT_ROW_COLS,
                                background: T.SURFACE_2,
                                borderColor: T.BORDER,
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.05em",
                                textTransform: "uppercase",
                                color: T.GRAY_DARKER,
                            }}
                        >
                            <span>{t("app.auditLog.when")}</span>
                            <span>{t("app.auditLog.who")}</span>
                            <span>{t("app.auditLog.action")}</span>
                            <span>{t("app.auditLog.record")}</span>
                            <span>{t("app.auditLog.changes")}</span>
                            <span>{t("app.auditLog.source")}</span>
                            <span aria-hidden="true" />
                        </div>

                        {loading && Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}

                        {!loading && error && (
                            <div className="px-4.5 py-8">
                                <EmptyState
                                    role="alert"
                                    icon="info"
                                    title={t("app.auditLog.loadFailed")}
                                    action={{
                                        label: t("app.auditLog.refresh"),
                                        icon: null,
                                        onClick: () => setRefreshKey((k) => k + 1),
                                    }}
                                />
                            </div>
                        )}

                        {!loading && !error && entries.length === 0 && (
                            <div className="px-4.5 py-8">
                                <EmptyState
                                    icon="activity"
                                    title={t("app.auditLog.emptyTitle")}
                                    description={t("app.auditLog.emptyDescription")}
                                    action={
                                        activeCount > 0
                                            ? { label: t("app.auditLog.clearFilters"), icon: null, onClick: reset }
                                            : undefined
                                    }
                                />
                            </div>
                        )}

                        {!loading &&
                            !error &&
                            entries.map((entry) => (
                                <AuditLogRow
                                    key={entry.id}
                                    entry={entry}
                                    expanded={expandedId === entry.id}
                                    onToggle={() => setExpandedId((id) => (id === entry.id ? null : entry.id))}
                                />
                            ))}
                    </div>

                    <Pagination
                        page={filters.page}
                        pageSize={filters.perPage}
                        totalItems={meta.total}
                        onPageChange={(page) => {
                            setExpandedId(null);
                            setPage(page);
                        }}
                        onPageSizeChange={(perPage) => update({ perPage })}
                        itemLabel="entry"
                        itemLabelPlural="entries"
                    />
                </div>
            </div>
        </PageLayout>
    );
}

AuditLogIndex.layout = (page: React.ReactNode) => <DashboardLayout>{page}</DashboardLayout>;
