import { useState, type ReactNode } from "react";
import { Link } from "@inertiajs/react";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import { avatarFill } from "../../people/format";
import { formatMoney } from "../../deals/format";
import { dayMonth } from "../format";
import type { ReportDeal, ReportLead, ReportMeeting, ReportNote, ReportTab, ReportWindow } from "./types";
import useReportList from "./useReportList";

const TABS: ReportTab[] = ["leads", "deals-created", "deals-closed", "meetings", "notes"];

interface Column<T> {
    key: string;
    label: string;
    render: (row: T) => ReactNode;
    /** Share of the row, in the grid's fr units. */
    width?: string;
}

interface TableProps<T> {
    label: string;
    columns: Array<Column<T>>;
    rows: T[];
    rowKey: (row: T) => number;
    /** The column the list is sorted by, marked in the header. */
    sorted?: string;
}

/** The list the tabs share: the Earnings table's chrome, with the columns of the list. */
function ReportTable<T>({ label, columns, rows, rowKey, sorted }: TableProps<T>) {
    const cols = columns.map((column) => `minmax(0, ${column.width ?? "1fr"})`).join(" ");
    return (
        <div role="table" aria-label={label} className="agent-ea__table agent-ea__table--report" style={{ ["--cols" as string]: cols }}>
            <div role="row" className="agent-ea__head">
                {columns.map((column) => (
                    <span key={column.key} role="columnheader" className="agent-ea__th" aria-sort={sorted === column.key ? "descending" : undefined}>
                        {column.label}
                        {sorted === column.key ? " ↑" : ""}
                    </span>
                ))}
            </div>
            {rows.map((row) => (
                <div key={rowKey(row)} role="row" className="agent-ea__row">
                    {columns.map((column) => (
                        <span key={column.key} role="cell" className={`agent-ea__cell agent-ea__cell--${column.key}`} data-label={column.label}>
                            {column.render(row)}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}

function Skeleton() {
    return (
        <div className="agent-ea__table agent-ea__table--report" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="agent-ea__row agent-ea__row--skeleton">
                    <i className="agent-ea__skeleton-dot" />
                    <i className="agent-ea__skeleton-line" />
                </div>
            ))}
        </div>
    );
}

function Person({ id, name, sub, href }: { id: number; name: string; sub?: string | null; href?: string }) {
    return (
        <span className="agent-ea__person">
            <span className="agent-ea__avatar" style={{ ["--fill" as string]: avatarFill(id) }} aria-hidden="true">
                {initialsFromName(name)}
            </span>
            <span className="agent-ea__who">
                {href ? (
                    <Link href={href} className="agent-ea__name">
                        {name}
                    </Link>
                ) : (
                    <span className="agent-ea__name">{name}</span>
                )}
                {sub ? <span className="agent-ea__sub">{sub}</span> : null}
            </span>
        </span>
    );
}

/** "today", "6 Nov" or "6 Nov 2025": the board's short dates. */
function useShortDate() {
    const { t, locale } = useTranslation();
    const year = new Date().getFullYear();
    return (iso: string | null | undefined): string => {
        if (!iso) return "—";
        const day = iso.slice(0, 10);
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        return day === todayKey ? t("pages.agent_workspace.earnings.report.today") : dayMonth(day, locale, year);
    };
}

const stripTags = (html: string | null) =>
    (html ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const dealHref = (deal: { id: number; lead_id?: number | null }) => (deal.lead_id ? route("agent.people.deal", { lead: deal.lead_id, deal: deal.id }) : route("agent.deals.show", deal.id));

interface ListProps {
    window: ReportWindow;
    agentId: number | null;
    currencySymbol: string;
    active: boolean;
}

function ListFooter({ shown, total, hasMore, loading, failed, onMore, onRetry }: { shown: number; total: number; hasMore: boolean; loading: boolean; failed: boolean; onMore: () => void; onRetry: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="agent-ea__list-foot">
            {failed ? (
                <span role="alert">
                    {t("pages.agent_workspace.earnings.report.list_failed")}{" "}
                    <button type="button" className="agent-ea__link" onClick={onRetry}>
                        {t("pages.agent_workspace.earnings.report.retry")}
                    </button>
                </span>
            ) : (
                <span>{t("pages.agent_workspace.earnings.report.showing", { shown, total })}</span>
            )}
            {hasMore ? (
                <button type="button" className="agent-ea__btn" disabled={loading} onClick={onMore}>
                    <Icon name="chevron-down" size={13} />
                    {t("pages.agent_workspace.earnings.report.more")}
                </button>
            ) : null}
        </div>
    );
}

/** One tab: loading, empty, the table and its footer. */
function ListBody<T>({ list, table, emptyKey }: { list: ReturnType<typeof useReportList<T>>; table: ReactNode; emptyKey: string }) {
    const { t } = useTranslation();
    if (list.page === 0 && list.loading) return <Skeleton />;
    if (list.page === 0 && list.failed)
        return (
            <EmptyState
                icon="search"
                title={t("pages.agent_workspace.earnings.report.list_failed")}
                action={{ label: t("pages.agent_workspace.earnings.report.retry"), icon: null, onClick: list.retry }}
            />
        );
    if (list.rows.length === 0) return <EmptyState icon="list" title={t(`pages.agent_workspace.earnings.report.empty.${emptyKey}`)} description={t("pages.agent_workspace.earnings.report.empty.description")} />;
    return (
        <>
            {table}
            <ListFooter shown={list.rows.length} total={list.total} hasMore={list.hasMore} loading={list.loading} failed={list.failed} onMore={list.more} onRetry={list.retry} />
        </>
    );
}

function LeadsList({ window, agentId, active }: ListProps) {
    const { t } = useTranslation();
    const date = useShortDate();
    const list = useReportList<ReportLead>("/account/agent-reports/leads", window, agentId, active);
    const k = (key: string) => t(`pages.agent_workspace.earnings.report.columns.${key}`);
    return (
        <ListBody
            list={list}
            emptyKey="leads"
            table={
                <ReportTable<ReportLead>
                    label={k("leads")}
                    rows={list.rows}
                    rowKey={(row) => row.id}
                    sorted="created"
                    columns={[
                        { key: "name", label: k("lead"), width: "2fr", render: (row) => <Person id={row.id} name={row.client_name} sub={row.client_email} href={route("agent.people.show", row.id)} /> },
                        { key: "source", label: k("source"), render: (row) => row.lead_source?.type ?? "—" },
                        { key: "created", label: k("created"), render: (row) => <span className="agent-ea__muted">{date(row.created_at)}</span> },
                    ]}
                />
            }
        />
    );
}

function DealsList({ window, agentId, currencySymbol, active, closed }: ListProps & { closed: boolean }) {
    const { t, locale } = useTranslation();
    const date = useShortDate();
    const list = useReportList<ReportDeal>(closed ? "/account/agent-reports/deals-closed" : "/account/agent-reports/deals-created", window, agentId, active);
    const k = (key: string) => t(`pages.agent_workspace.earnings.report.columns.${key}`);
    const columns: Array<Column<ReportDeal>> = [
        { key: "deal", label: k("deal"), width: "1.6fr", render: (row) => <Link href={dealHref(row)} className="agent-ea__name">{row.name}</Link> },
        {
            key: "contact",
            label: k("contact"),
            width: "1.5fr",
            render: (row) => (row.contact ? <Person id={row.contact.id} name={row.contact.client_name} sub={row.contact.lead_source?.type} href={route("agent.people.show", row.contact.id)} /> : "—"),
        },
        ...(closed
            ? []
            : [
                  {
                      key: "stage",
                      label: k("stage"),
                      render: (row: ReportDeal) =>
                          row.lead_stage ? (
                              <span className="agent-ea__stage">
                                  <i style={{ background: row.lead_stage.label_color || "var(--dr-blue)" }} aria-hidden="true" />
                                  {row.lead_stage.name}
                              </span>
                          ) : (
                              "—"
                          ),
                  },
              ]),
        {
            key: "value",
            label: k("value"),
            render: (row) => <span className="agent-ea__amount">{row.value === null ? "—" : formatMoney(Number(row.value), row.currency?.currency_symbol || currencySymbol, locale)}</span>,
        },
        { key: closed ? "closed" : "created", label: k(closed ? "closed" : "created"), render: (row) => <span className="agent-ea__muted">{date(closed ? row.close_date : row.created_at)}</span> },
    ];
    return (
        <ListBody
            list={list}
            emptyKey={closed ? "deals_closed" : "deals_created"}
            table={<ReportTable<ReportDeal> label={k(closed ? "deals_closed" : "deals_created")} rows={list.rows} rowKey={(row) => row.id} columns={columns} sorted={closed ? "closed" : "created"} />}
        />
    );
}

function MeetingsList({ window, agentId, active }: ListProps) {
    const { t } = useTranslation();
    const date = useShortDate();
    const list = useReportList<ReportMeeting>("/account/agent-reports/meetings", window, agentId, active);
    const k = (key: string) => t(`pages.agent_workspace.earnings.report.columns.${key}`);
    return (
        <ListBody
            list={list}
            emptyKey="meetings"
            table={
                <ReportTable<ReportMeeting>
                    label={k("meetings")}
                    rows={list.rows}
                    rowKey={(row) => row.id}
                    sorted="date"
                    columns={[
                        { key: "deal", label: k("deal"), width: "1.6fr", render: (row) => (row.deal ? <Link href={dealHref(row.deal)} className="agent-ea__name">{row.deal.name}</Link> : "—") },
                        { key: "type", label: k("type"), render: (row) => row.meeting_type?.name ?? "—" },
                        { key: "status", label: k("status"), render: (row) => row.status ?? "—" },
                        { key: "duration", label: k("duration"), render: (row) => (row.duration ? t("pages.agent_workspace.earnings.report.minutes", { count: row.duration }) : "—") },
                        { key: "date", label: k("date"), render: (row) => <span className="agent-ea__muted">{date(row.next_follow_up_date)}</span> },
                    ]}
                />
            }
        />
    );
}

function NotesList({ window, agentId, active, kind }: ListProps & { kind: "lead" | "deal" }) {
    const { t } = useTranslation();
    const date = useShortDate();
    const list = useReportList<ReportNote>(`/account/agent-reports/${kind}-notes`, window, agentId, active);
    const k = (key: string) => t(`pages.agent_workspace.earnings.report.columns.${key}`);
    return (
        <ListBody
            list={list}
            emptyKey="notes"
            table={
                <ReportTable<ReportNote>
                    label={k("notes")}
                    rows={list.rows}
                    rowKey={(row) => row.id}
                    sorted="date"
                    columns={[
                        {
                            key: "note",
                            label: k("note"),
                            width: "2.4fr",
                            render: (row) => (
                                <span className="agent-ea__who">
                                    <span className="agent-ea__name">{row.title?.trim() || t("pages.agent_workspace.earnings.report.untitled")}</span>
                                    <span className="agent-ea__sub agent-ea__sub--clamp">{stripTags(row.details)}</span>
                                </span>
                            ),
                        },
                        {
                            key: "about",
                            label: k(kind === "lead" ? "lead" : "deal"),
                            width: "1.3fr",
                            render: (row) =>
                                kind === "lead" ? (
                                    row.lead ? <Link href={route("agent.people.show", row.lead.id)} className="agent-ea__name">{row.lead.client_name}</Link> : "—"
                                ) : row.deal ? (
                                    <Link href={dealHref(row.deal)} className="agent-ea__name">{row.deal.name}</Link>
                                ) : (
                                    "—"
                                ),
                        },
                        { key: "date", label: k("date"), render: (row) => <span className="agent-ea__muted">{date(row.created_at)}</span> },
                    ]}
                />
            }
        />
    );
}

interface ReportListsProps {
    window: ReportWindow;
    agentId: number | null;
    currencySymbol: string;
}

/**
 * The lists under the summary (L7-38): Leads, Deals Created, Deals Closed,
 * Meetings and Notes, for the period at the top. They are the classic Agent
 * Reports lists, asked for this agent and shown in the workspace's table.
 * Only Deals Created is drawn on the board; the others follow it.
 */
export default function ReportLists({ window, agentId, currencySymbol }: ReportListsProps) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<ReportTab>("deals-created");
    const [notes, setNotes] = useState<"lead" | "deal">("lead");
    const [visited, setVisited] = useState<Set<ReportTab>>(() => new Set(["deals-created"]));
    const props = { window, agentId, currencySymbol };

    return (
        <section className="agent-ea__lists">
            <div className="agent-ea__list-tabs" role="tablist" aria-label={t("pages.agent_workspace.earnings.report.tabs.label")}>
                {TABS.map((key) => (
                    <button key={key} type="button" role="tab" id={`report-tab-${key}`} aria-selected={tab === key} aria-controls="report-panel" className="agent-ea__list-tab" onClick={() => {
                            setTab(key);
                            setVisited((current) => (current.has(key) ? current : new Set(current).add(key)));
                        }}>
                        {t(`pages.agent_workspace.earnings.report.tabs.${key}`)}
                    </button>
                ))}
                {tab === "notes" ? (
                    <span className="agent-ea__list-switch" role="group" aria-label={t("pages.agent_workspace.earnings.report.notes_kind")}>
                        {(["lead", "deal"] as const).map((kind) => (
                            <button key={kind} type="button" aria-pressed={notes === kind} onClick={() => setNotes(kind)}>
                                {t(`pages.agent_workspace.earnings.report.notes.${kind}`)}
                            </button>
                        ))}
                    </span>
                ) : null}
            </div>
            <div role="tabpanel" id="report-panel" aria-labelledby={`report-tab-${tab}`}>
                {/* A tab's list is fetched the first time it is shown and kept, hidden, after that. */}
                {visited.has("leads") ? <div hidden={tab !== "leads"}><LeadsList {...props} active={tab === "leads"} /></div> : null}
                {visited.has("deals-created") ? <div hidden={tab !== "deals-created"}><DealsList {...props} closed={false} active={tab === "deals-created"} /></div> : null}
                {visited.has("deals-closed") ? <div hidden={tab !== "deals-closed"}><DealsList {...props} closed active={tab === "deals-closed"} /></div> : null}
                {visited.has("meetings") ? <div hidden={tab !== "meetings"}><MeetingsList {...props} active={tab === "meetings"} /></div> : null}
                {visited.has("notes") ? (
                    <div hidden={tab !== "notes"}>
                        <NotesList {...props} kind={notes} active={tab === "notes"} />
                    </div>
                ) : null}
            </div>
        </section>
    );
}
