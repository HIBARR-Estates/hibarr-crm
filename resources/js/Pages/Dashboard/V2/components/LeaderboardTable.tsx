import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@inertiajs/react";
import {
    Avatar,
    Icon,
    Pagination,
    REDESIGN_TOKENS as T,
    initialsFromName,
} from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TeamAgents, TeamAgentRow } from "../types";

const GRID = "minmax(170px, 1.6fr) .7fr .8fr 1.2fr .8fr .8fr .7fr minmax(150px, 1.5fr)";

type SortColumn =
    | "name"
    | "leads"
    | "meetings"
    | "contact_rate"
    | "deals"
    | "won"
    | "open_deals"
    | "attention";
type SortDir = "asc" | "desc";

interface ListWindow {
    from?: string;
    to?: string;
}

/**
 * Per-agent detail — the coaching surface.
 *
 * The contact-rate bar carries a marker at the median across all agents,
 * because a number on its own can't tell a manager whether 75% is the problem
 * or the baseline.
 * Missing values render as "—": an agent with no new leads has no contact rate,
 * which is not the same as a 0% one.
 *
 * Default order is triage (SLA breaches, then contact rate). Any column header
 * re-sorts the full set; pagination is client-side because the payload is
 * already the whole active-agent list.
 *
 * Counts open the matching list with that page's own filters: owner/agent,
 * the dashboard window, and (for needs-attention) uncontacted leads or open
 * deals. Zero stays a number, not a link.
 */
export default function LeaderboardTable({
    data,
    currentUserId,
    from,
    to,
}: {
    data: TeamAgents;
    currentUserId?: number;
    from?: string;
    to?: string;
}) {
    const { td } = useTd();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sort, setSort] = useState<{ column: SortColumn; dir: SortDir } | null>(
        null,
    );

    const sorted = useMemo(() => {
        if (!sort) {
            return data.rows;
        }

        const copy = [...data.rows];
        copy.sort((a, b) => {
            const delta = compareRows(a, b, sort.column);
            if (delta !== 0) {
                return sort.dir === "asc" ? delta : -delta;
            }

            return a.name.localeCompare(b.name);
        });

        return copy;
    }, [data.rows, sort]);

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageRows = sorted.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize,
    );

    const toggleSort = (column: SortColumn) => {
        setSort((current) =>
            current?.column === column
                ? { column, dir: current.dir === "desc" ? "asc" : "desc" }
                : {
                      column,
                      // Names read A→Z first; numeric columns triage high→low.
                      dir: column === "name" ? "asc" : "desc",
                  },
        );
        setPage(1);
    };

    if (!data.rows.length) {
        return (
            <div style={{ padding: 18 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    {td("No active agents yet", { source: "en" })}
                </p>
                <p
                    style={{
                        margin: "4px 0 0",
                        fontSize: 13,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {td(
                        "This view covers every enabled lead agent with an active account.",
                        { source: "en" },
                    )}
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="dv2-scroll-x">
                <div style={{ minWidth: 900 }}>
                    <div
                        className="dv2-eyebrow"
                        style={{
                            display: "grid",
                            gridTemplateColumns: GRID,
                            columnGap: 14,
                            padding: "9px 18px",
                            background: T.SURFACE_2,
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <SortHeader
                            label={td("Agent", { source: "en" })}
                            column="name"
                            sort={sort}
                            onSort={toggleSort}
                            align="left"
                        />
                        <SortHeader
                            label={td("Leads", { source: "en" })}
                            column="leads"
                            sort={sort}
                            onSort={toggleSort}
                        />
                        <SortHeader
                            label={td("Meetings", { source: "en" })}
                            column="meetings"
                            sort={sort}
                            onSort={toggleSort}
                        />
                        <SortHeader
                            label={`${td("Contacted in", { source: "en" })} ${data.sla_hours}h`}
                            column="contact_rate"
                            sort={sort}
                            onSort={toggleSort}
                            align="left"
                        />
                        <SortHeader
                            label={td("Deals", { source: "en" })}
                            column="deals"
                            sort={sort}
                            onSort={toggleSort}
                        />
                        <SortHeader
                            label={td("Won", { source: "en" })}
                            column="won"
                            sort={sort}
                            onSort={toggleSort}
                        />
                        <SortHeader
                            label={td("Open", { source: "en" })}
                            column="open_deals"
                            sort={sort}
                            onSort={toggleSort}
                        />
                        <SortHeader
                            label={td("Needs attention", { source: "en" })}
                            column="attention"
                            sort={sort}
                            onSort={toggleSort}
                            align="left"
                        />
                    </div>

                    {pageRows.map((row, index) => (
                        <Row
                            key={row.agent_id}
                            row={row}
                            median={data.median_contact_rate}
                            isYou={
                                currentUserId !== undefined &&
                                row.user_id === currentUserId
                            }
                            last={index === pageRows.length - 1}
                            from={from}
                            to={to}
                        />
                    ))}
                </div>
            </div>

            <Pagination
                page={safePage}
                pageSize={pageSize}
                totalItems={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                }}
                itemLabel="agent"
                itemLabelPlural="agents"
            />
        </div>
    );
}

/** Ascending delta; caller flips for desc. Null contact rates sort after numbers. */
function compareRows(
    a: TeamAgentRow,
    b: TeamAgentRow,
    column: SortColumn,
): number {
    if (column === "name") {
        return a.name.localeCompare(b.name);
    }

    if (column === "contact_rate") {
        if (a.contact_rate === null && b.contact_rate === null) return 0;
        if (a.contact_rate === null) return 1;
        if (b.contact_rate === null) return -1;

        return a.contact_rate - b.contact_rate;
    }

    if (column === "attention") {
        return (
            a.sla_breaches +
            a.stalled_deals -
            (b.sla_breaches + b.stalled_deals)
        );
    }

    return a[column] - b[column];
}

function SortHeader({
    label,
    column,
    sort,
    onSort,
    align = "right",
}: {
    label: string;
    column: SortColumn;
    sort: { column: SortColumn; dir: SortDir } | null;
    onSort: (column: SortColumn) => void;
    align?: "left" | "right";
}) {
    const active = sort?.column === column;
    const iconName =
        active && sort.dir === "asc" ? "chevron-up" : "chevron-down";

    return (
        <div
            role="columnheader"
            aria-sort={
                !active
                    ? "none"
                    : sort.dir === "asc"
                      ? "ascending"
                      : "descending"
            }
        >
            <button
                type="button"
                onClick={() => onSort(column)}
                aria-label={`${label}: ${active ? (sort.dir === "desc" ? "sorted descending" : "sorted ascending") : "sort"}`}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent:
                        align === "left" ? "flex-start" : "flex-end",
                    gap: 3,
                    width: "100%",
                    margin: 0,
                    padding: 0,
                    border: 0,
                    background: "none",
                    // Same size/weight as sibling eyebrow headers; blue +
                    // icon mark the active sort column.
                    color: active ? T.BLUE : "inherit",
                    font: "inherit",
                    letterSpacing: "inherit",
                    textTransform: "inherit",
                    cursor: "pointer",
                }}
            >
                {label}
                {active ? (
                    <Icon name={iconName} size={12} color="currentColor" />
                ) : (
                    <span
                        aria-hidden
                        style={{
                            display: "inline-flex",
                            flexDirection: "column",
                            lineHeight: 0,
                            opacity: 0.55,
                        }}
                    >
                        <Icon name="chevron-up" size={8} color="currentColor" />
                        <Icon
                            name="chevron-down"
                            size={8}
                            color="currentColor"
                        />
                    </span>
                )}
            </button>
        </div>
    );
}

function Row({
    row,
    median,
    isYou,
    last,
    from,
    to,
}: {
    row: TeamAgentRow;
    median: number | null;
    isYou: boolean;
    last: boolean;
    from?: string;
    to?: string;
}) {
    const { td } = useTd();
    const listWindow: ListWindow = { from, to };
    const userId = row.user_id;

    const slaLabel = row.sla_breaches
        ? `${row.sla_breaches} ${td("leads over SLA", { source: "en" })}`
        : null;
    const stalledLabel = row.stalled_deals
        ? `${row.stalled_deals} ${td("deals stalled", { source: "en" })}`
        : null;

    const rate = row.contact_rate;
    const barColor =
        rate === null
            ? T.BORDER
            : rate >= 80
              ? T.GREEN
              : rate >= 50
                ? T.BLUE
                : T.RED;

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: GRID,
                columnGap: 14,
                alignItems: "center",
                padding: "12px 18px",
                fontSize: 14,
                borderBottom: last ? undefined : `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar
                    size={30}
                    initials={initialsFromName(row.name)}
                    type={isYou ? "watcher" : "agent"}
                    src={row.image}
                />
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {row.name}
                    </div>
                    <div style={{ fontSize: 12, color: T.TEXT_HINT }}>
                        {isYou ? `${td("You", { source: "en" })} · ` : ""}
                        <CountLink
                            href={
                                userId != null && row.open_deals > 0
                                    ? dealListHref(userId, {
                                          outcome_status: "open",
                                      })
                                    : null
                            }
                        >
                            {row.open_deals} {td("open deals", { source: "en" })}
                        </CountLink>
                    </div>
                </div>
            </div>

            <div style={{ textAlign: "right" }}>
                <CountLink
                    href={
                        userId != null && row.leads > 0
                            ? leadListHref(userId, {}, listWindow)
                            : null
                    }
                >
                    {row.leads}
                </CountLink>
            </div>
            <div style={{ textAlign: "right" }}>
                <CountLink
                    href={
                        userId != null && row.meetings > 0
                            ? meetingListHref(userId, listWindow)
                            : null
                    }
                >
                    {row.meetings}
                </CountLink>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                    style={{
                        flex: 1,
                        position: "relative",
                        height: 8,
                        background: "#f2f4f7",
                        borderRadius: 4,
                    }}
                >
                    <div
                        style={{
                            height: 8,
                            width: `${rate ?? 0}%`,
                            background: barColor,
                            borderRadius: 4,
                        }}
                    />
                    {median !== null && (
                        <span
                            aria-hidden
                            title={`${td("Team median", { source: "en" })} ${median}%`}
                            style={{
                                position: "absolute",
                                left: `${median}%`,
                                top: -3,
                                width: 2,
                                height: 14,
                                background: T.TEXT_HINT,
                            }}
                        />
                    )}
                </div>
                <span
                    style={{
                        fontSize: 13,
                        fontWeight: 600,
                        width: 34,
                        textAlign: "right",
                        color: rate === null ? T.TEXT_HINT : barColor,
                    }}
                >
                    {rate === null ? "—" : `${rate}%`}
                </span>
            </div>

            <div style={{ textAlign: "right" }}>
                <CountLink
                    href={
                        userId != null && row.deals > 0
                            ? dealListHref(userId, dated(listWindow))
                            : null
                    }
                >
                    {row.deals}
                </CountLink>
            </div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>
                <CountLink
                    href={
                        userId != null && row.won > 0
                            ? dealListHref(userId, {
                                  outcome_status: "won",
                                  ...dated(listWindow),
                              })
                            : null
                    }
                >
                    {row.won}
                </CountLink>
            </div>
            <div style={{ textAlign: "right", color: T.TEXT_MUTED }}>
                <CountLink
                    href={
                        userId != null && row.open_deals > 0
                            ? dealListHref(userId, { outcome_status: "open" })
                            : null
                    }
                >
                    {row.open_deals}
                </CountLink>
            </div>

            <div
                style={{
                    fontSize: 13,
                    fontWeight: slaLabel || stalledLabel ? 600 : 400,
                    color: slaLabel || stalledLabel ? T.RED : T.TEXT_HINT,
                }}
            >
                {slaLabel || stalledLabel ? (
                    <>
                        {slaLabel ? (
                            <CountLink
                                href={
                                    userId != null
                                        ? leadListHref(userId, {
                                              contact_status: "uncontacted",
                                          })
                                        : null
                                }
                                tone={T.RED}
                            >
                                {slaLabel}
                            </CountLink>
                        ) : null}
                        {slaLabel && stalledLabel ? " · " : null}
                        {stalledLabel ? (
                            <CountLink
                                href={
                                    userId != null
                                        ? dealListHref(userId, {
                                              outcome_status: "open",
                                          })
                                        : null
                                }
                                tone={T.RED}
                            >
                                {stalledLabel}
                            </CountLink>
                        ) : null}
                    </>
                ) : (
                    "—"
                )}
            </div>
        </div>
    );
}

function CountLink({
    href,
    children,
    tone,
}: {
    href: string | null;
    children: ReactNode;
    tone?: string;
}) {
    if (!href) {
        return <>{children}</>;
    }

    return (
        <Link
            href={href}
            className="dv2-metric-link"
            data-tone={tone === T.RED ? "danger" : undefined}
        >
            {children}
        </Link>
    );
}

function dated(window: ListWindow): Record<string, string> {
    return {
        ...(window.from ? { start_date: window.from } : {}),
        ...(window.to ? { end_date: window.to } : {}),
    };
}

function leadListHref(
    userId: number,
    extra: Record<string, string> = {},
    window: ListWindow = {},
): string {
    return route("lead-contact.index", {
        lead_owner_id: userId,
        ...dated(window),
        ...extra,
    });
}

function dealListHref(
    userId: number,
    extra: Record<string, string> = {},
): string {
    return route("deals.index", {
        agent_id: userId,
        lead_pipeline_id: "all",
        ...extra,
    });
}

function meetingListHref(userId: number, window: ListWindow = {}): string {
    return route("meetings.index", {
        host_id: userId,
        ...(window.from ? { date_from: window.from } : {}),
        ...(window.to ? { date_to: window.to } : {}),
    });
}
