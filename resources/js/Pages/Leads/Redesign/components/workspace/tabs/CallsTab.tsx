import { useMemo, useState } from "react";
import CallLogItem from "@/Components/Redesign/calls/CallLogItem";
import CallSummaryTiles from "@/Components/Redesign/calls/CallSummaryTiles";
import useCallLog from "@/Components/Redesign/calls/useCallLog";
import type { CallLogFilters, CallLogRow } from "@/Components/Redesign/calls/types";
import ChipToggle from "@/Components/Redesign/primitives/ChipToggle";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import WorkspaceTabSectionHeader from "@/Components/Redesign/workspace/WorkspaceTabSectionHeader";
import { TabDeferredSkeleton } from "@/Pages/Deals/Redesign/components/workspace/overview/overviewShared";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { formatCallDuration } from "@/lib/crmEvents/callSummary";

type Filter = "all" | "inbound" | "outbound" | "missed" | "recorded";

const FILTERS: Record<Filter, CallLogFilters> = {
    all: {},
    inbound: { direction: "inbound" },
    outbound: { direction: "outbound" },
    missed: { outcome: "missed" },
    recorded: { has_recording: true },
};

interface CallsTabProps {
    leadId: number;
}

/**
 * Every call on the lead and on its deals the viewer can see, newest first,
 * grouped by day, with the recording played in place. Loads in the background
 * when the tab opens; the tab count comes from the deferred `callSummary`.
 */
export default function CallsTab({ leadId }: CallsTabProps) {
    const { t } = useTranslation();
    const { formatDate } = useUserDateTime();
    const [filter, setFilter] = useState<Filter>("all");
    const [page, setPage] = useState(1);

    const query = useCallLog(
        route("lead-contact.calls.index", leadId),
        FILTERS[filter],
        page,
        50,
    );
    const rows = query.data?.data ?? [];
    const meta = query.data?.meta;
    const summary = query.data?.summary;

    // Day headings: "Today", "Yesterday" or the date.
    const groups = useMemo(() => {
        const out: Array<{ key: string; label: string; rows: CallLogRow[] }> = [];
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

        for (const row of rows) {
            const d = row.occurred_at ? new Date(row.occurred_at) : null;
            const key = d ? dayKey(d) : "unknown";
            const label = !d
                ? "—"
                : key === dayKey(today)
                  ? t("pages.calls.today")
                  : key === dayKey(yesterday)
                    ? t("pages.calls.yesterday")
                    : formatDate(row.occurred_at);
            const last = out[out.length - 1];
            if (last && last.key === key) {
                last.rows.push(row);
            } else {
                out.push({ key, label, rows: [row] });
            }
        }
        return out;
    }, [rows, t, formatDate]);

    if (query.isLoading && !query.data) {
        return <TabDeferredSkeleton />;
    }

    const tiles = summary
        ? [
              { label: t("pages.calls.tile_calls"), value: String(summary.total) },
              {
                  label: t("pages.calls.tile_connected"),
                  value:
                      summary.connected > 0 && summary.connected_seconds > 0
                          ? `${summary.connected} · ${formatCallDuration(summary.connected_seconds, t)}`
                          : String(summary.connected),
              },
              {
                  label: t("pages.calls.tile_missed"),
                  value: String(summary.missed),
                  tone: summary.missed > 0 ? ("danger" as const) : ("default" as const),
              },
              {
                  label: t("pages.calls.tile_last_call"),
                  value: summary.last_at ? formatDate(summary.last_at) : "—",
              },
          ]
        : [];

    const chips: Array<{ id: Filter; label: string }> = [
        { id: "all", label: t("pages.calls.filter_all") },
        { id: "inbound", label: t("pages.calls.filter_inbound") },
        { id: "outbound", label: t("pages.calls.filter_outbound") },
        { id: "missed", label: t("pages.calls.filter_missed") },
        { id: "recorded", label: t("pages.calls.filter_recorded") },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <WorkspaceTabSectionHeader
                title={t("pages.calls.lead_tab_title")}
                count={summary?.total}
                hint={t("pages.calls.lead_tab_hint")}
            />

            {tiles.length > 0 && <CallSummaryTiles tiles={tiles} />}

            <section
                aria-label={t("pages.calls.lead_tab_title")}
                style={{
                    background: T.SURFACE,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 10,
                    overflow: "hidden",
                }}
            >
                <div
                    role="group"
                    aria-label={t("pages.calls.filter_label")}
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        padding: "12px 18px",
                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                    }}
                >
                    {chips.map((chip) => (
                        <ChipToggle
                            key={chip.id}
                            shape="pill"
                            active={filter === chip.id}
                            onClick={() => {
                                setFilter(chip.id);
                                setPage(1);
                            }}
                        >
                            {chip.label}
                        </ChipToggle>
                    ))}
                </div>

                {query.isError ? (
                    <div style={{ padding: 18 }}>
                        <EmptyState
                            role="alert"
                            title={t("pages.calls.load_failed")}
                            action={{ label: t("pages.calls.retry"), onClick: () => void query.refetch() }}
                        />
                    </div>
                ) : rows.length === 0 ? (
                    <div style={{ padding: 18 }}>
                        <EmptyState
                            title={
                                filter === "all"
                                    ? t("pages.calls.empty_title")
                                    : t("pages.calls.empty_filtered_title")
                            }
                            description={filter === "all" ? t("pages.calls.empty_lead_description") : undefined}
                        />
                    </div>
                ) : (
                    groups.map((group) => (
                        <div key={group.key}>
                            <div
                                className="dr-label"
                                style={{
                                    padding: "8px 18px 4px",
                                    color: T.TEXT_MUTED,
                                    background: T.SURFACE_2,
                                }}
                            >
                                {group.label}
                            </div>
                            {group.rows.map((row) => (
                                <CallLogItem key={row.id} row={row} timeOnly />
                            ))}
                        </div>
                    ))
                )}

                {meta && meta.last_page > 1 && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            padding: "12px 18px",
                            fontSize: 12,
                            color: T.TEXT_MUTED,
                        }}
                    >
                        <span>{t("pages.calls.page_of", { page: meta.page, pages: meta.last_page })}</span>
                        <span style={{ display: "flex", gap: 6 }}>
                            <ChipToggle active={false} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                                {t("pages.calls.previous")}
                            </ChipToggle>
                            <ChipToggle
                                active={false}
                                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                            >
                                {t("pages.calls.next")}
                            </ChipToggle>
                        </span>
                    </div>
                )}
            </section>

            <p style={{ margin: 0, fontSize: 12, color: T.TEXT_HINT }}>{t("pages.calls.lead_tab_footnote")}</p>
        </div>
    );
}
