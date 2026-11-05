import { useEffect, useMemo, useState, type ReactNode } from "react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import "@/Components/Redesign/redesign.css";
import CallLogItem from "@/Components/Redesign/calls/CallLogItem";
import CallSummaryTiles from "@/Components/Redesign/calls/CallSummaryTiles";
import useCallLog from "@/Components/Redesign/calls/useCallLog";
import type { CallLogFilters, CallLogSummary, CallOutcome } from "@/Components/Redesign/calls/types";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import EntityListHeader from "@/Components/Redesign/primitives/EntityListHeader";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import Pagination from "@/Components/Redesign/primitives/Pagination";
import Switch from "@/Components/Redesign/primitives/Switch";
import { REDESIGN_FONT_STACK, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";

interface CallsPageProps extends PageProps {
    pageTitle: string;
    agents: Array<{ id: number; name: string }>;
    /** Deferred: today's totals for the tiles. */
    summary?: CallLogSummary;
}

/**
 * Calls — every call made or received through the CRM, its recording and the
 * lead or deal it belongs to. Call managers only (admins, manage_calls); the
 * server gates the page and the rows the same way.
 */
export default function CallsIndex({ agents, summary }: CallsPageProps) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [direction, setDirection] = useState<"" | "inbound" | "outbound">("");
    const [outcome, setOutcome] = useState<"" | CallOutcome>("");
    const [agent, setAgent] = useState<number | "">("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [recordedOnly, setRecordedOnly] = useState(false);
    const [unlinkedOnly, setUnlinkedOnly] = useState(false);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);

    useEffect(() => {
        const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => window.clearTimeout(id);
    }, [search]);

    const filters = useMemo<CallLogFilters>(
        () => ({
            search: debouncedSearch,
            direction,
            outcome,
            user_id: agent,
            from,
            to,
            has_recording: recordedOnly,
            unlinked: unlinkedOnly,
        }),
        [debouncedSearch, direction, outcome, agent, from, to, recordedOnly, unlinkedOnly],
    );

    useEffect(() => setPage(1), [filters]);

    const query = useCallLog(route("telephony.calls.log"), filters, page, perPage);
    const rows = query.data?.data ?? [];
    const total = query.data?.meta.total ?? 0;

    const tiles = summary
        ? [
              { label: t("pages.calls.tile_today"), value: String(summary.total) },
              { label: t("pages.calls.tile_connected"), value: String(summary.connected) },
              {
                  label: t("pages.calls.tile_missed"),
                  value: String(summary.missed),
                  tone: summary.missed > 0 ? ("danger" as const) : ("default" as const),
              },
              {
                  label: t("pages.calls.tile_unlinked"),
                  value: String(summary.unlinked),
                  tone: summary.unlinked > 0 ? ("warning" as const) : ("default" as const),
              },
          ]
        : [];

    const fieldLabel = (text: string, control: ReactNode, grow = 1) => (
        <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: `${grow} 1 150px`, minWidth: 0 }}>
            <span className="dr-label" style={{ color: T.TEXT_MUTED }}>
                {text}
            </span>
            {control}
        </label>
    );

    return (
        <PageLayout
            title={t("app.menu.calls")}
            breadcrumbs={[{ name: t("app.menu.calls") }]}
            mainContentClassName="p-0"
        >
            <EntityListHeader title={t("app.menu.calls")} subtitle={t("pages.calls.page_subtitle")} sticky />

            <div
                style={{
                    padding: "20px 28px 40px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    fontFamily: REDESIGN_FONT_STACK,
                    background: T.BG,
                    minHeight: "100%",
                }}
            >
                {tiles.length > 0 && <CallSummaryTiles tiles={tiles} />}

                <section
                    aria-label={t("pages.calls.all_calls")}
                    style={{ background: T.SURFACE, border: `1px solid ${T.BORDER}`, borderRadius: 10, overflow: "hidden" }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "flex-end",
                            gap: 12,
                            padding: "14px 18px",
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        {fieldLabel(
                            t("pages.calls.search"),
                            <input
                                type="search"
                                className="dr-input"
                                value={search}
                                placeholder={t("pages.calls.search_placeholder")}
                                onChange={(e) => setSearch(e.target.value)}
                            />,
                            2,
                        )}
                        {fieldLabel(
                            t("pages.calls.agent"),
                            <MenuSelect
                                fullWidth
                                searchable
                                value={agent}
                                onChange={(v) => setAgent(v === "" ? "" : Number(v))}
                                options={[
                                    { value: "", label: t("pages.calls.all_agents") },
                                    ...agents.map((a) => ({ value: a.id, label: a.name })),
                                ]}
                            />,
                        )}
                        {fieldLabel(
                            t("pages.calls.direction"),
                            <MenuSelect
                                fullWidth
                                value={direction}
                                onChange={(v) => setDirection(v as "" | "inbound" | "outbound")}
                                options={[
                                    { value: "", label: t("pages.calls.any_direction") },
                                    { value: "inbound", label: t("pages.calls.filter_inbound") },
                                    { value: "outbound", label: t("pages.calls.filter_outbound") },
                                ]}
                            />,
                        )}
                        {fieldLabel(
                            t("pages.calls.outcome"),
                            <MenuSelect
                                fullWidth
                                value={outcome}
                                onChange={(v) => setOutcome(v as "" | CallOutcome)}
                                options={[
                                    { value: "", label: t("pages.calls.any_outcome") },
                                    { value: "ended", label: t("pages.call_summary.completed") },
                                    { value: "missed", label: t("pages.call_summary.missed") },
                                    { value: "declined", label: t("pages.call_summary.declined") },
                                    { value: "busy", label: t("pages.call_summary.busy") },
                                    { value: "voicemail", label: t("pages.call_summary.voicemail") },
                                    { value: "failed", label: t("pages.call_summary.failed") },
                                ]}
                            />,
                        )}
                        {fieldLabel(
                            t("pages.calls.from"),
                            <input type="date" className="dr-input" value={from} onChange={(e) => setFrom(e.target.value)} />,
                        )}
                        {fieldLabel(
                            t("pages.calls.to"),
                            <input type="date" className="dr-input" value={to} onChange={(e) => setTo(e.target.value)} />,
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, paddingBottom: 8 }}>
                            <Switch
                                checked={recordedOnly}
                                onChange={() => setRecordedOnly((v) => !v)}
                                label={t("pages.calls.filter_recorded")}
                            />
                            <Switch
                                checked={unlinkedOnly}
                                onChange={() => setUnlinkedOnly((v) => !v)}
                                label={t("pages.calls.filter_unlinked")}
                            />
                        </div>
                    </div>

                    {query.isLoading && !query.data ? (
                        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }} aria-busy="true">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="dr-skeleton" style={{ height: 48, borderRadius: 8 }} />
                            ))}
                        </div>
                    ) : query.isError ? (
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
                                icon="phone"
                                title={t("pages.calls.empty_filtered_title")}
                                description={t("pages.calls.empty_page_description")}
                            />
                        </div>
                    ) : (
                        rows.map((row) => <CallLogItem key={row.id} row={row} showEntity />)
                    )}

                    {total > 0 && (
                        <div style={{ padding: "8px 18px", borderTop: `1px solid ${T.BORDER_SOFT}` }}>
                            <Pagination
                                page={page}
                                pageSize={perPage}
                                totalItems={total}
                                onPageChange={setPage}
                                onPageSizeChange={(size) => {
                                    setPerPage(size);
                                    setPage(1);
                                }}
                                itemLabel={t("pages.calls.item_label")}
                                itemLabelPlural={t("pages.calls.item_label_plural")}
                            />
                        </div>
                    )}
                </section>
            </div>
        </PageLayout>
    );
}

CallsIndex.layout = (page: ReactNode) => <DashboardLayout>{page}</DashboardLayout>;
