import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";

const GRID_COLS =
    "130px minmax(150px, 1.4fr) minmax(140px, 1fr) 84px 96px 118px 172px";
const MIN_TABLE_WIDTH = 906;

interface TimelineEvent {
    dot: string;
    color: string;
    label: string;
    when: string;
}

interface ReminderRow {
    id: number;
    entityType: string;
    entityId: number;
    chipLabel: string;
    chipBg: string;
    chipColor: string;
    about: string;
    sub: string;
    entityName: string;
    entityDetail: string;
    subject: string;
    body: string;
    timeline: TimelineEvent[];
    name: string;
    email: string;
    initials: string;
    avatarBg: string;
    avatarColor: string;
    timeText: string;
    deliveryText: string;
    deliveryColor: string;
    deliveryWeight: string;
    statusLabel: string;
    statusBg: string;
    statusColor: string;
    dotColor: string;
    createdBy: string;
    cancellable: boolean;
    rowBg: string;
    lastError?: string | null;
}

interface ReminderGroup {
    label: string;
    sub: string;
    shortSub: string;
    rows: ReminderRow[];
}

interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Filters {
    tab: string;
    entity_type: string;
    search: string;
    date_range: string;
    custom_date: string;
    per_page: number;
}

interface Stats {
    sent: number;
    delayed: number;
    cancelled: number;
    failed: number;
}

interface TabCounts {
    all: number;
    delayed: number;
    sent: number;
    cancelled: number;
    failed: number;
}

interface RemindersPageProps {
    groups: ReminderGroup[];
    pagination: PaginationMeta;
    stats: Stats;
    tabCounts: TabCounts;
    filters: Filters;
    entityTypes: string[];
    showDelayBanner: boolean;
    delayBannerText: string;
    worstDelay: string;
    hasFilters: boolean;
    isEmpty: boolean;
    [key: string]: unknown;
}

const TAB_ITEMS = [
    { key: "all", label: "All" },
    { key: "delayed", label: "Delayed" },
    { key: "sent", label: "Sent" },
    { key: "cancelled", label: "Cancelled" },
    { key: "failed", label: "Failed" },
] as const;

const ENTITY_LABELS: Record<string, string> = {
    meeting: "Meetings",
    task: "Tasks",
    deal_note: "Notes",
    lead_note: "Notes",
    deal: "Deals",
    lead: "Leads",
    property: "Properties",
    developer_project: "Projects",
    unit: "Units",
    flight_itinerary: "Flights",
};

function useIsMobile(breakpoint = 768): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, [breakpoint]);

    return isMobile;
}

function StatusPill({ row }: { row: ReminderRow }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                fontWeight: 500,
                background: row.statusBg,
                color: row.statusColor,
                borderRadius: 999,
                padding: "3px 10px",
            }}
        >
            <span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: row.dotColor,
                }}
            />
            {row.statusLabel}
        </span>
    );
}

function RowActions({
    row,
    onSend,
    onCancel,
}: {
    row: ReminderRow;
    onSend: (id: number) => void;
    onCancel: (id: number) => void;
}) {
    if (!row.cancellable) {
        return null;
    }

    return (
        <span
            style={{ display: "flex", gap: 8, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                onClick={() => onSend(row.id)}
                style={{
                    appearance: "none",
                    fontFamily: "inherit",
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: "#1d4ed8",
                    background: "#fff",
                    border: "1px solid #b2ddff",
                    borderRadius: 8,
                    padding: "9px 14px",
                    cursor: "pointer",
                    minHeight: 44,
                    whiteSpace: "nowrap",
                }}
            >
                Send now
            </button>
            <button
                type="button"
                onClick={() => onCancel(row.id)}
                style={{
                    appearance: "none",
                    fontFamily: "inherit",
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: "#b42318",
                    background: "#fff",
                    border: "1px solid #fecdca",
                    borderRadius: 8,
                    padding: "9px 14px",
                    cursor: "pointer",
                    minHeight: 44,
                    whiteSpace: "nowrap",
                }}
            >
                Cancel
            </button>
        </span>
    );
}

function DetailDrawer({
    row,
    isMobile,
    confirmCancel,
    confirmSend,
    onClose,
    onAskSend,
    onAskCancel,
    onConfirmSend,
    onConfirmCancel,
    onAbortSend,
    onAbortCancel,
}: {
    row: ReminderRow;
    isMobile: boolean;
    confirmCancel: boolean;
    confirmSend: boolean;
    onClose: () => void;
    onAskSend: () => void;
    onAskCancel: () => void;
    onConfirmSend: () => void;
    onConfirmCancel: () => void;
    onAbortSend: () => void;
    onAbortCancel: () => void;
}) {
    const drawerStyle: React.CSSProperties = isMobile
        ? {
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: "92vh",
              background: "#fff",
              zIndex: 50,
              boxShadow: "0 -8px 40px rgba(16,24,40,0.18)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              borderRadius: "16px 16px 0 0",
          }
        : {
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 420,
              background: "#fff",
              zIndex: 50,
              boxShadow: "0 8px 40px rgba(16,24,40,0.18)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              borderRadius: 0,
          };

    const noConfirmPending = !confirmCancel && !confirmSend;

    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(16,24,40,0.35)",
                    zIndex: 40,
                }}
            />
            <div style={drawerStyle}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "18px 20px 16px",
                        borderBottom: "1px solid #e4e7ec",
                        position: "sticky",
                        top: 0,
                        background: "#fff",
                        zIndex: 2,
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: 12,
                                color: "#98a2b3",
                            }}
                        >
                            Reminder #{row.id}
                        </div>
                        <div
                            style={{
                                fontSize: 18,
                                fontWeight: 700,
                                letterSpacing: "-0.01em",
                                marginTop: 2,
                                lineHeight: 1.3,
                            }}
                        >
                            {row.about}
                        </div>
                        <div style={{ marginTop: 8 }}>
                            <StatusPill row={row} />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            appearance: "none",
                            background: "none",
                            border: "none",
                            fontSize: 22,
                            lineHeight: 1,
                            color: "#98a2b3",
                            cursor: "pointer",
                            padding: 8,
                            minWidth: 44,
                            minHeight: 44,
                            flexShrink: 0,
                        }}
                    >
                        ×
                    </button>
                </div>

                <div
                    style={{
                        padding: 20,
                        display: "flex",
                        flexDirection: "column",
                        gap: 20,
                        flex: 1,
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: "#98a2b3",
                                marginBottom: 8,
                            }}
                        >
                            What it&apos;s about
                        </div>
                        <div
                            style={{
                                background: "#f8f9fb",
                                border: "1px solid #eef0f3",
                                borderRadius: 10,
                                padding: "12px 14px",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexWrap: "wrap",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                        background: row.chipBg,
                                        color: row.chipColor,
                                        borderRadius: 6,
                                        padding: "3px 8px",
                                    }}
                                >
                                    {row.chipLabel}
                                </span>
                                <span
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "#1a202c",
                                    }}
                                >
                                    {row.entityName}
                                </span>
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "#667085",
                                    marginTop: 6,
                                }}
                            >
                                {row.entityDetail}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: "#98a2b3",
                                marginBottom: 8,
                            }}
                        >
                            Email message
                        </div>
                        <div
                            style={{
                                border: "1px solid #eef0f3",
                                borderRadius: 10,
                                padding: "12px 14px",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 13.5,
                                    fontWeight: 600,
                                    color: "#344054",
                                }}
                            >
                                {row.subject}
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "#667085",
                                    marginTop: 4,
                                    lineHeight: 1.5,
                                }}
                            >
                                {row.body}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: "#98a2b3",
                                marginBottom: 8,
                            }}
                        >
                            Who
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <span
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: "50%",
                                    background: row.avatarBg,
                                    color: row.avatarColor,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                {row.initials}
                            </span>
                            <span style={{ minWidth: 0 }}>
                                <span
                                    style={{
                                        display: "block",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "#1a202c",
                                    }}
                                >
                                    {row.name}
                                </span>
                                <span
                                    style={{
                                        display: "block",
                                        fontSize: 12.5,
                                        color: "#98a2b3",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {row.email}
                                </span>
                            </span>
                        </div>
                        <div
                            style={{
                                fontSize: 12.5,
                                color: "#667085",
                                marginTop: 8,
                            }}
                        >
                            Created by {row.createdBy}
                        </div>
                    </div>

                    <div>
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: "#98a2b3",
                                marginBottom: 8,
                            }}
                        >
                            Timeline
                        </div>
                        {row.timeline.map((ev) => (
                            <div
                                key={`${ev.label}-${ev.when}`}
                                style={{
                                    display: "flex",
                                    gap: 10,
                                    padding: "5px 0",
                                }}
                            >
                                <span
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: ev.dot,
                                        marginTop: 5,
                                        flexShrink: 0,
                                    }}
                                />
                                <span>
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 13.5,
                                            fontWeight: 500,
                                            color: ev.color,
                                        }}
                                    >
                                        {ev.label}
                                    </span>
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 12.5,
                                            color: "#98a2b3",
                                        }}
                                    >
                                        {ev.when}
                                    </span>
                                </span>
                            </div>
                        ))}
                    </div>

                    {row.lastError && (
                        <div
                            style={{
                                background: "#fef3f2",
                                border: "1px solid #fecdca",
                                borderRadius: 10,
                                padding: "10px 14px",
                                fontSize: 13.5,
                                color: "#b42318",
                            }}
                        >
                            {row.lastError}
                        </div>
                    )}
                </div>

                {row.cancellable && (
                    <div
                        style={{
                            padding: "14px 20px calc(14px + env(safe-area-inset-bottom))",
                            borderTop: "1px solid #e4e7ec",
                            background: "#fcfcfd",
                            position: "sticky",
                            bottom: 0,
                        }}
                    >
                        {confirmCancel && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    flexWrap: "wrap",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 13.5,
                                        color: "#93370d",
                                        flex: "1 1 100%",
                                    }}
                                >
                                    Cancel this reminder? It won&apos;t be sent.
                                </span>
                                <button
                                    type="button"
                                    onClick={onConfirmCancel}
                                    style={{
                                        appearance: "none",
                                        flex: 1,
                                        fontFamily: "inherit",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "#fff",
                                        background: "#d92d20",
                                        border: "none",
                                        borderRadius: 8,
                                        padding: "11px 14px",
                                        cursor: "pointer",
                                        minHeight: 44,
                                    }}
                                >
                                    Yes, cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={onAbortCancel}
                                    style={{
                                        appearance: "none",
                                        flex: 1,
                                        fontFamily: "inherit",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "#344054",
                                        background: "#fff",
                                        border: "1px solid #d0d5dd",
                                        borderRadius: 8,
                                        padding: "11px 14px",
                                        cursor: "pointer",
                                        minHeight: 44,
                                    }}
                                >
                                    Keep
                                </button>
                            </div>
                        )}
                        {confirmSend && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    flexWrap: "wrap",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 13.5,
                                        color: "#175cd3",
                                        flex: "1 1 100%",
                                    }}
                                >
                                    Send this reminder now, ahead of schedule?
                                </span>
                                <button
                                    type="button"
                                    onClick={onConfirmSend}
                                    style={{
                                        appearance: "none",
                                        flex: 1,
                                        fontFamily: "inherit",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "#fff",
                                        background: "#2563eb",
                                        border: "none",
                                        borderRadius: 8,
                                        padding: "11px 14px",
                                        cursor: "pointer",
                                        minHeight: 44,
                                    }}
                                >
                                    Yes, send now
                                </button>
                                <button
                                    type="button"
                                    onClick={onAbortSend}
                                    style={{
                                        appearance: "none",
                                        flex: 1,
                                        fontFamily: "inherit",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "#344054",
                                        background: "#fff",
                                        border: "1px solid #d0d5dd",
                                        borderRadius: 8,
                                        padding: "11px 14px",
                                        cursor: "pointer",
                                        minHeight: 44,
                                    }}
                                >
                                    Not yet
                                </button>
                            </div>
                        )}
                        {noConfirmPending && (
                            <div
                                style={{
                                    display: "flex",
                                    gap: 10,
                                    flexWrap: "wrap",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={onAskSend}
                                    style={{
                                        appearance: "none",
                                        flex: "1 1 140px",
                                        fontFamily: "inherit",
                                        fontSize: 15,
                                        fontWeight: 600,
                                        color: "#fff",
                                        background: "#2563eb",
                                        border: "none",
                                        borderRadius: 8,
                                        padding: "12px 14px",
                                        cursor: "pointer",
                                        minHeight: 48,
                                    }}
                                >
                                    Send now
                                </button>
                                <button
                                    type="button"
                                    onClick={onAskCancel}
                                    style={{
                                        appearance: "none",
                                        flex: "1 1 140px",
                                        fontFamily: "inherit",
                                        fontSize: 15,
                                        fontWeight: 600,
                                        color: "#b42318",
                                        background: "#fff",
                                        border: "1px solid #fecdca",
                                        borderRadius: 8,
                                        padding: "12px 14px",
                                        cursor: "pointer",
                                        minHeight: 48,
                                    }}
                                >
                                    Cancel reminder
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

export default function RemindersIndex() {
    const { props: pageProps } = usePage<any>();
    const typedProps = pageProps as RemindersPageProps;
    const groups = typedProps.groups ?? [];
    const pagination = typedProps.pagination ?? {
        current_page: 1,
        last_page: 1,
        per_page: 25,
        total: 0,
        from: null,
        to: null,
    };
    const stats = typedProps.stats ?? {
        sent: 0,
        delayed: 0,
        cancelled: 0,
        failed: 0,
    };
    const tabCounts = typedProps.tabCounts ?? {
        all: 0,
        delayed: 0,
        sent: 0,
        cancelled: 0,
        failed: 0,
    };
    const filters = typedProps.filters ?? {
        tab: "all",
        entity_type: "all",
        search: "",
        date_range: "all",
        custom_date: "",
        per_page: 25,
    };
    const entityTypes = typedProps.entityTypes ?? [];
    const showDelayBanner = typedProps.showDelayBanner ?? false;
    const delayBannerText = typedProps.delayBannerText ?? "";
    const worstDelay = typedProps.worstDelay ?? "—";
    const hasFilters = typedProps.hasFilters ?? false;
    const isEmpty = typedProps.isEmpty ?? groups.length === 0;

    const isMobile = useIsMobile();
    const pagePad = isMobile ? "20px 16px 48px" : "32px 40px 64px";
    const h1Size = isMobile ? 22 : 24;

    const [searchValue, setSearchValue] = useState(filters.search || "");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [confirmSend, setConfirmSend] = useState(false);
    const [hoverRowId, setHoverRowId] = useState<number | null>(null);

    useEffect(() => {
        const id = "reminders-ledger-fonts";
        if (document.getElementById(id)) {
            return;
        }
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href =
            "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
        document.head.appendChild(link);
    }, []);

    const reload = useCallback(
        (next: Partial<Filters>) => {
            router.get(
                route("reminder-ledger.index"),
                {
                    tab: next.tab ?? filters.tab,
                    entity_type: next.entity_type ?? filters.entity_type,
                    search: next.search ?? filters.search,
                    date_range: next.date_range ?? filters.date_range,
                    custom_date: next.custom_date ?? filters.custom_date,
                    per_page: next.per_page ?? filters.per_page,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                },
            );
        },
        [filters],
    );

    const allRows = useMemo(
        () => groups.flatMap((g) => g.rows),
        [groups],
    );
    const selectedRow =
        allRows.find((r) => r.id === selectedId) || null;

    const resultCount = useMemo(() => {
        if (pagination.total === 0) {
            return "0 reminders";
        }
        if (pagination.from && pagination.to) {
            return `${pagination.from}–${pagination.to} of ${pagination.total}`;
        }
        return `${pagination.total} reminder${pagination.total === 1 ? "" : "s"}`;
    }, [pagination]);

    const statCards = [
        { label: "Sent", value: stats.sent, color: "#067647" },
        { label: "Delayed", value: stats.delayed, color: "#b54708" },
        { label: "Cancelled", value: stats.cancelled, color: "#475467" },
        { label: "Failed", value: stats.failed, color: "#b42318" },
    ];

    const closeDrawer = () => {
        setSelectedId(null);
        setConfirmCancel(false);
        setConfirmSend(false);
    };

    const reloadList = () => {
        router.reload({
            only: [
                "groups",
                "stats",
                "tabCounts",
                "pagination",
                "showDelayBanner",
                "delayBannerText",
                "worstDelay",
                "isEmpty",
                "hasFilters",
            ],
        });
    };

    const handleCancel = (id: number) => {
        router.post(
            route("reminder-ledger.cancel", { reminder: id }),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    closeDrawer();
                    reloadList();
                },
            },
        );
    };

    const handleSendNow = (id: number) => {
        router.post(
            route("reminder-ledger.send-now", { reminder: id }),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    closeDrawer();
                    reloadList();
                },
            },
        );
    };

    const showDatePicker = filters.date_range === "custom";

    return (
        <DashboardLayout>
            <style>{`
                .om-scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .rd-row:hover { background: #f5f8ff !important; }
            `}</style>
            <div
                style={{
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    color: "#1a202c",
                    minHeight: "100vh",
                    padding: pagePad,
                    background: "#f4f5f7",
                }}
            >
                <div
                    style={{
                        maxWidth: 1240,
                        margin: "0 auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-end",
                            justifyContent: "space-between",
                            gap: 16,
                            flexWrap: "wrap",
                        }}
                    >
                        <div>
                            <h1
                                style={{
                                    margin: 0,
                                    fontSize: h1Size,
                                    fontWeight: 700,
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                Reminders
                            </h1>
                            <p
                                style={{
                                    margin: "4px 0 0",
                                    fontSize: 14,
                                    color: "#667085",
                                }}
                            >
                                Scheduled and sent reminder emails
                            </p>
                        </div>
                    </div>

                    <div
                        className="om-scroll-x"
                        style={{
                            display: "flex",
                            gap: 10,
                            paddingBottom: 2,
                        }}
                    >
                        {statCards.map((s) => (
                            <div
                                key={s.label}
                                style={{
                                    background: "#fff",
                                    border: "1px solid #e4e7ec",
                                    borderRadius: 10,
                                    padding: "10px 16px",
                                    minWidth: 96,
                                    flex: "1 0 auto",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                        color: "#667085",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {s.label}
                                </div>
                                <div
                                    style={{
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: s.color,
                                    }}
                                >
                                    {s.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {showDelayBanner && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                background: "#fffaeb",
                                border: "1px solid #fedf89",
                                borderRadius: 10,
                                padding: "10px 16px",
                                fontSize: 13.5,
                                color: "#93370d",
                                lineHeight: 1.45,
                            }}
                        >
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: "#f79009",
                                    flexShrink: 0,
                                    marginTop: 6,
                                }}
                            />
                            <span>
                                <strong style={{ fontWeight: 600 }}>
                                    {delayBannerText}
                                </strong>{" "}
                                — delivery ran behind schedule. Worst delay:{" "}
                                {worstDelay}.
                            </span>
                        </div>
                    )}

                    <div
                        style={{
                            background: "#fff",
                            border: "1px solid #e4e7ec",
                            borderRadius: 12,
                            overflow: "hidden",
                        }}
                    >
                        <div
                            className="om-scroll-x"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "8px 12px 0",
                                borderBottom: "1px solid #e4e7ec",
                            }}
                        >
                            {TAB_ITEMS.map((tab) => {
                                const active = filters.tab === tab.key;
                                const count =
                                    tabCounts[
                                        tab.key as keyof TabCounts
                                    ] ?? 0;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() =>
                                            reload({ tab: tab.key })
                                        }
                                        style={{
                                            appearance: "none",
                                            background: "none",
                                            border: "none",
                                            borderBottom: `2px solid ${active ? "#2563eb" : "transparent"}`,
                                            padding: "10px 10px 12px",
                                            fontFamily: "inherit",
                                            fontSize: 14,
                                            fontWeight: active ? 600 : 500,
                                            color: active
                                                ? "#1a202c"
                                                : "#667085",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 7,
                                            whiteSpace: "nowrap",
                                            flex: "0 0 auto",
                                            minHeight: 44,
                                        }}
                                    >
                                        {tab.label}
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background: active
                                                    ? "#eff8ff"
                                                    : "#f2f4f7",
                                                color: active
                                                    ? "#175cd3"
                                                    : "#475467",
                                                borderRadius: 999,
                                                padding: "1px 8px",
                                            }}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                                padding: 12,
                                borderBottom: "1px solid #e4e7ec",
                                background: "#fcfcfd",
                            }}
                        >
                            <input
                                value={searchValue}
                                onChange={(e) =>
                                    setSearchValue(e.target.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        reload({ search: searchValue });
                                    }
                                }}
                                placeholder="Search reminder, email, or entity…"
                                style={{
                                    flex: "1 1 200px",
                                    minWidth: 0,
                                    maxWidth: 340,
                                    fontFamily: "inherit",
                                    fontSize: 16,
                                    color: "#1a202c",
                                    background: "#fff",
                                    border: "1px solid #d0d5dd",
                                    borderRadius: 8,
                                    padding: "10px 12px",
                                    outline: "none",
                                }}
                            />
                            <select
                                value={filters.entity_type || "all"}
                                onChange={(e) =>
                                    reload({
                                        entity_type: e.target.value,
                                    })
                                }
                                style={{
                                    flex: "0 1 auto",
                                    fontFamily: "inherit",
                                    fontSize: 16,
                                    color: "#1a202c",
                                    background: "#fff",
                                    border: "1px solid #d0d5dd",
                                    borderRadius: 8,
                                    padding: 10,
                                    outline: "none",
                                    cursor: "pointer",
                                    minHeight: 44,
                                }}
                            >
                                <option value="all">All types</option>
                                {entityTypes.map((type) => (
                                    <option key={type} value={type}>
                                        {ENTITY_LABELS[type] ||
                                            type.replace(/_/g, " ")}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={filters.date_range || "all"}
                                onChange={(e) =>
                                    reload({
                                        date_range: e.target.value,
                                        custom_date:
                                            e.target.value === "custom"
                                                ? filters.custom_date
                                                : "",
                                    })
                                }
                                style={{
                                    flex: "0 1 auto",
                                    fontFamily: "inherit",
                                    fontSize: 16,
                                    color: "#1a202c",
                                    background: "#fff",
                                    border: "1px solid #d0d5dd",
                                    borderRadius: 8,
                                    padding: 10,
                                    outline: "none",
                                    cursor: "pointer",
                                    minHeight: 44,
                                }}
                            >
                                <option value="all">All dates</option>
                                <option value="today">Today</option>
                                <option value="yesterday">Yesterday</option>
                                <option value="7d">Last 7 days</option>
                                <option value="custom">Specific day…</option>
                            </select>
                            {showDatePicker && (
                                <input
                                    type="date"
                                    value={filters.custom_date || ""}
                                    onChange={(e) =>
                                        reload({
                                            date_range: "custom",
                                            custom_date: e.target.value,
                                        })
                                    }
                                    style={{
                                        fontFamily: "inherit",
                                        fontSize: 16,
                                        color: "#1a202c",
                                        background: "#fff",
                                        border: "1px solid #d0d5dd",
                                        borderRadius: 8,
                                        padding: "9px 10px",
                                        outline: "none",
                                        cursor: "pointer",
                                        minHeight: 44,
                                    }}
                                />
                            )}
                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchValue("");
                                        reload({
                                            tab: "all",
                                            entity_type: "all",
                                            search: "",
                                            date_range: "all",
                                            custom_date: "",
                                        });
                                    }}
                                    style={{
                                        appearance: "none",
                                        background: "none",
                                        border: "none",
                                        fontFamily: "inherit",
                                        fontSize: 13.5,
                                        fontWeight: 500,
                                        color: "#1d4ed8",
                                        cursor: "pointer",
                                        padding: 8,
                                        minHeight: 44,
                                    }}
                                >
                                    Reset
                                </button>
                            )}
                            <div
                                style={{
                                    marginLeft: "auto",
                                    fontSize: 13,
                                    color: "#667085",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {resultCount}
                            </div>
                        </div>

                        {!isMobile && !isEmpty && (
                            <div className="om-scroll-x">
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: GRID_COLS,
                                        minWidth: MIN_TABLE_WIDTH,
                                        boxSizing: "border-box",
                                        padding: "0 16px",
                                        borderBottom: "1px solid #e4e7ec",
                                        background: "#fcfcfd",
                                    }}
                                >
                                    {[
                                        "Entity",
                                        "Reminder",
                                        "Recipient",
                                        "Remind at",
                                        "Delivery",
                                        "Status",
                                        "",
                                    ].map((label) => (
                                        <div
                                            key={label || "actions"}
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                                color: "#667085",
                                                padding: "10px 8px",
                                            }}
                                        >
                                            {label}
                                        </div>
                                    ))}
                                </div>
                                {groups.map((g) => (
                                    <div key={g.label}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "baseline",
                                                gap: 10,
                                                flexWrap: "wrap",
                                                minWidth: MIN_TABLE_WIDTH,
                                                boxSizing: "border-box",
                                                padding: "10px 24px",
                                                background: "#f8f9fb",
                                                borderBottom:
                                                    "1px solid #e4e7ec",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    color: "#344054",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {g.label}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 12.5,
                                                    color: "#98a2b3",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {g.sub}
                                            </span>
                                        </div>
                                        {g.rows.map((r) => (
                                            <div
                                                key={r.id}
                                                className="rd-row"
                                                onClick={() => {
                                                    setSelectedId(r.id);
                                                    setConfirmCancel(false);
                                                    setConfirmSend(false);
                                                }}
                                                onMouseEnter={() =>
                                                    setHoverRowId(r.id)
                                                }
                                                onMouseLeave={() =>
                                                    setHoverRowId(null)
                                                }
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        GRID_COLS,
                                                    minWidth: MIN_TABLE_WIDTH,
                                                    boxSizing: "border-box",
                                                    alignItems: "center",
                                                    padding: "0 16px",
                                                    borderBottom:
                                                        "1px solid #eef0f3",
                                                    cursor: "pointer",
                                                    background:
                                                        hoverRowId === r.id
                                                            ? "#f5f8ff"
                                                            : r.rowBg,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        padding: "11px 8px",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            textTransform:
                                                                "uppercase",
                                                            letterSpacing:
                                                                "0.04em",
                                                            background:
                                                                r.chipBg,
                                                            color: r.chipColor,
                                                            borderRadius: 6,
                                                            padding:
                                                                "3px 8px",
                                                        }}
                                                    >
                                                        {r.chipLabel}
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        padding: "9px 8px",
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: 14,
                                                            fontWeight: 500,
                                                            color: "#1a202c",
                                                            overflow: "hidden",
                                                            textOverflow:
                                                                "ellipsis",
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        {r.about}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            color: "#98a2b3",
                                                            overflow: "hidden",
                                                            textOverflow:
                                                                "ellipsis",
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        {r.sub}
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        padding: "11px 8px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 9,
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            width: 26,
                                                            height: 26,
                                                            borderRadius: "50%",
                                                            background:
                                                                r.avatarBg,
                                                            color: r.avatarColor,
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {r.initials}
                                                    </span>
                                                    <span
                                                        style={{ minWidth: 0 }}
                                                    >
                                                        <span
                                                            style={{
                                                                display:
                                                                    "block",
                                                                fontSize: 13.5,
                                                                fontWeight: 500,
                                                                color: "#344054",
                                                                overflow:
                                                                    "hidden",
                                                                textOverflow:
                                                                    "ellipsis",
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            {r.name}
                                                        </span>
                                                        <span
                                                            style={{
                                                                display:
                                                                    "block",
                                                                fontSize: 12,
                                                                color: "#98a2b3",
                                                                overflow:
                                                                    "hidden",
                                                                textOverflow:
                                                                    "ellipsis",
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            {r.email}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        padding: "11px 8px",
                                                        fontSize: 13.5,
                                                        color: "#344054",
                                                        fontVariantNumeric:
                                                            "tabular-nums",
                                                    }}
                                                >
                                                    {r.timeText}
                                                </div>
                                                <div
                                                    style={{
                                                        padding: "11px 8px",
                                                        fontSize: 13,
                                                        fontWeight:
                                                            r.deliveryWeight as React.CSSProperties["fontWeight"],
                                                        color: r.deliveryColor,
                                                    }}
                                                >
                                                    {r.deliveryText}
                                                </div>
                                                <div
                                                    style={{
                                                        padding: "11px 8px",
                                                    }}
                                                >
                                                    <StatusPill row={r} />
                                                </div>
                                                <div
                                                    style={{
                                                        padding: "11px 8px",
                                                        display: "flex",
                                                        justifyContent:
                                                            "flex-end",
                                                    }}
                                                >
                                                    <RowActions
                                                        row={r}
                                                        onSend={(id) =>
                                                            handleSendNow(id)
                                                        }
                                                        onCancel={(id) =>
                                                            handleCancel(id)
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}

                        {isMobile && !isEmpty && (
                            <div>
                                {groups.map((g) => (
                                    <div key={g.label}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "baseline",
                                                gap: 8,
                                                padding: "10px 16px",
                                                background: "#f8f9fb",
                                                borderBottom:
                                                    "1px solid #e4e7ec",
                                                position: "sticky",
                                                top: 0,
                                                zIndex: 2,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    color: "#344054",
                                                }}
                                            >
                                                {g.label}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 12,
                                                    color: "#98a2b3",
                                                }}
                                            >
                                                {g.shortSub}
                                            </span>
                                        </div>
                                        {g.rows.map((r) => (
                                            <div
                                                key={r.id}
                                                onClick={() => {
                                                    setSelectedId(r.id);
                                                    setConfirmCancel(false);
                                                    setConfirmSend(false);
                                                }}
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 8,
                                                    padding: "14px 16px",
                                                    borderBottom:
                                                        "1px solid #eef0f3",
                                                    cursor: "pointer",
                                                    background: r.rowBg,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "space-between",
                                                        gap: 10,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            textTransform:
                                                                "uppercase",
                                                            letterSpacing:
                                                                "0.04em",
                                                            background:
                                                                r.chipBg,
                                                            color: r.chipColor,
                                                            borderRadius: 6,
                                                            padding:
                                                                "3px 8px",
                                                        }}
                                                    >
                                                        {r.chipLabel}
                                                    </span>
                                                    <StatusPill row={r} />
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: 15,
                                                            fontWeight: 600,
                                                            color: "#1a202c",
                                                            lineHeight: 1.3,
                                                        }}
                                                    >
                                                        {r.about}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 12.5,
                                                            color: "#98a2b3",
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        {r.sub}
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            width: 22,
                                                            height: 22,
                                                            borderRadius: "50%",
                                                            background:
                                                                r.avatarBg,
                                                            color: r.avatarColor,
                                                            fontSize: 10,
                                                            fontWeight: 600,
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {r.initials}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: 13,
                                                            color: "#667085",
                                                            overflow: "hidden",
                                                            textOverflow:
                                                                "ellipsis",
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        {r.email}
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "space-between",
                                                        gap: 10,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 13,
                                                            color: "#344054",
                                                            fontVariantNumeric:
                                                                "tabular-nums",
                                                        }}
                                                    >
                                                        {r.timeText} ·{" "}
                                                        <span
                                                            style={{
                                                                color: r.deliveryColor,
                                                                fontWeight:
                                                                    r.deliveryWeight as React.CSSProperties["fontWeight"],
                                                            }}
                                                        >
                                                            {r.deliveryText}
                                                        </span>
                                                    </span>
                                                    <RowActions
                                                        row={r}
                                                        onSend={(id) =>
                                                            handleSendNow(id)
                                                        }
                                                        onCancel={(id) =>
                                                            handleCancel(id)
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}

                        {isEmpty && (
                            <div
                                style={{
                                    padding: "48px 24px",
                                    textAlign: "center",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 15,
                                        fontWeight: 600,
                                        color: "#344054",
                                    }}
                                >
                                    No reminders match
                                </div>
                                <div
                                    style={{
                                        fontSize: 13.5,
                                        color: "#667085",
                                        marginTop: 4,
                                    }}
                                >
                                    Try clearing the search, date, or tab
                                    filters.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedRow && (
                <DetailDrawer
                    row={selectedRow}
                    isMobile={isMobile}
                    confirmCancel={confirmCancel}
                    confirmSend={confirmSend}
                    onClose={closeDrawer}
                    onAskSend={() => {
                        setConfirmSend(true);
                        setConfirmCancel(false);
                    }}
                    onAskCancel={() => {
                        setConfirmCancel(true);
                        setConfirmSend(false);
                    }}
                    onConfirmSend={() => handleSendNow(selectedRow.id)}
                    onConfirmCancel={() => handleCancel(selectedRow.id)}
                    onAbortSend={() => setConfirmSend(false)}
                    onAbortCancel={() => setConfirmCancel(false)}
                />
            )}
        </DashboardLayout>
    );
}
