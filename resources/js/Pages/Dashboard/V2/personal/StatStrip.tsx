import { useMemo } from "react";
import { Deferred } from "@inertiajs/react";
import dayjs from "dayjs";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import type { CommissionSummary, PersonalStats, PipelineRow } from "./types";
import { money } from "../format";
import { dominantTotal, mergeCurrencyTotals } from "./format";
import FilterBadge from "./FilterBadge";

type Tone = "up" | "down" | "flat";

interface Tile {
    key: string;
    label: string;
    value: string;
    sub: string;
    /** One line of context under the value. */
    ratio: string;
    /**
     * The chip is a link into a filtered list, so it only exists when that
     * list would show something — "0 left" or "none idle" isn't a click
     * worth offering, and a chip that goes nowhere useful is worse than no
     * chip. Omit chip/tone/href together; the tile still shows its label,
     * value and ratio without one.
     */
    chip?: string;
    tone?: Tone;
    href?: string;
}

/** Same three-tone reading the design system uses everywhere else: green is
 * good, red needs attention, gray is neutral. */
const CHIP_VARIANT: Record<Tone, "green" | "red" | "gray"> = {
    up: "green",
    down: "red",
    flat: "gray",
};

interface StatStripProps {
    /** Whose lists the badges link into. */
    userId: number;
    /** How far the page looks back and ahead, from the server. */
    windowDays: number;
    /**
     * The server's own clock (ISO 8601), matching what personalStats()
     * counted against — used instead of the browser's clock so the
     * missed-meetings link's date window can't drift from the count it's
     * labeling under a client/server timezone or clock skew.
     */
    now: string;
    stats?: PersonalStats;
    pipelines?: PipelineRow[];
    /** undefined while loading; null for anyone who isn't an agent — that
     * slot is dropped once known, never zeroed. */
    commission?: CommissionSummary | null;
}

/** Days a deal counts as idle — matches openDealsByPipeline()'s own default. */
const IDLE_DAYS = 7;

/**
 * One card per subject this person is measured on.
 *
 * No gauges and no progress bars: a bar implies a target, and HIBARR stores
 * none — so each tile is a headline number, a second figure, a risk chip and
 * one line of context.
 *
 * All four slots render immediately, every load — Leads/Deals/Your week/
 * Commission never come or go one at a time as their own deferred prop
 * happens to land. Each slot swaps its own skeleton for its own data the
 * moment that data is ready; the other three don't wait on it and don't
 * move. Commission is the one slot that can resolve to "doesn't apply" (no
 * lead_agent record) rather than data — that's the only case the grid loses
 * a column, and only once, when the answer is finally known.
 */
export default function StatStrip({
    userId,
    windowDays,
    now,
    stats,
    pipelines,
    commission,
}: StatStripProps) {
    const { t } = useTranslation();

    const lookBack = `${t("pages.dashboard.personal.stats.last")} ${windowDays} ${t("pages.dashboard.personal.stats.days")}`;
    const lookAhead = `${t("pages.dashboard.personal.stats.next")} ${windowDays} ${t("pages.dashboard.personal.stats.days")}`;

    const leadsTile: Tile | undefined = useMemo(
        () =>
            stats
                ? (() => {
                      const { leads } = stats;

                      return {
                          key: "leads",
                          label: t("pages.dashboard.personal.stats.leads"),
                          value: `${leads.new} ${t("pages.dashboard.personal.stats.new")}`,
                          sub: lookBack,
                          ratio: leads.new
                              ? `${leads.contacted} ${t("pages.dashboard.personal.stats.of")} ${leads.new} ${t("pages.dashboard.personal.stats.contacted")}`
                              : t(
                                    "pages.dashboard.personal.stats.leads_empty_ratio",
                                ),
                          ...(leads.uncontacted
                              ? {
                                    chip: `${leads.uncontacted} ${t("pages.dashboard.personal.stats.uncontacted")}`,
                                    tone: "down" as const,
                                    href: route("lead-contact.index", {
                                        lead_owner_id: userId,
                                        contact_status: "uncontacted",
                                    }),
                                }
                              : {}),
                      };
                  })()
                : undefined,
        [stats, t, lookBack, userId],
    );

    const dealsTile: Tile | undefined = useMemo(
        () =>
            pipelines
                ? (() => {
                      const open = pipelines.reduce(
                          (sum, p) => sum + p.deal_count,
                          0,
                      );
                      const idle = pipelines.reduce(
                          (sum, p) => sum + p.idle_count,
                          0,
                      );
                      const totals = mergeCurrencyTotals(
                          pipelines.flatMap((p) => p.totals),
                      );

                      return {
                          key: "deals",
                          label: t("pages.dashboard.personal.stats.deals"),
                          value: `${open} ${t("pages.dashboard.personal.stats.open")}`,
                          sub:
                              open && totals.length
                                  ? dominantTotal(totals).label
                                  : "",
                          ratio: open
                              ? `${t("pages.dashboard.personal.stats.across")} ${pipelines.length} ${pipelines.length === 1 ? t("pages.dashboard.personal.stats.pipeline") : t("pages.dashboard.personal.stats.pipelines")}`
                              : t(
                                    "pages.dashboard.personal.stats.deals_empty_ratio",
                                ),
                          ...(idle
                              ? {
                                    chip: `${idle} ${t("pages.dashboard.personal.stats.idle_for")} ${IDLE_DAYS}+ ${t("pages.dashboard.personal.stats.days")}`,
                                    tone: "down" as const,
                                    href: route("deals.index", {
                                        agent_id: userId,
                                        outcome_status: "open",
                                        lead_pipeline_id: "all",
                                        idle_days: IDLE_DAYS,
                                    }),
                                }
                              : {}),
                      };
                  })()
                : undefined,
        [pipelines, t, userId],
    );

    const meetingsTile: Tile | undefined = useMemo(
        () =>
            stats
                ? (() => {
                      const { meetings } = stats;
                      const logged = meetings.attended + meetings.missed;

                      return {
                          key: "meetings",
                          label: t("pages.dashboard.personal.stats.meetings"),
                          value: `${meetings.upcoming} ${t("pages.dashboard.personal.stats.upcoming")}`,
                          sub: lookAhead,
                          ratio: logged
                              ? `${meetings.attended} ${t("pages.dashboard.personal.stats.attended")} · ${meetings.missed} ${t("pages.dashboard.personal.stats.missed")}`
                              : t(
                                    "pages.dashboard.personal.stats.meetings_empty_ratio",
                                ),
                          ...(meetings.missed
                              ? {
                                    chip: `${meetings.missed} ${t("pages.dashboard.personal.stats.missed")}`,
                                    tone: "down" as const,
                                    href: route("meetings.index", {
                                        attendance: "no_show",
                                        date_from: dayjs(now)
                                            .subtract(windowDays, "day")
                                            .format("YYYY-MM-DD"),
                                        date_to: dayjs(now).format("YYYY-MM-DD"),
                                    }),
                                }
                              : {}),
                      };
                  })()
                : undefined,
        [stats, t, lookAhead, now, windowDays],
    );

    const commissionTile: Tile | undefined = useMemo(
        () =>
            commission == null
                ? undefined
                : (() => {
                      const earned = commission.earned[0];
                      const previous = commission.previous.find(
                          (row) => row.currency === earned?.currency,
                      );
                      const delta =
                          earned && previous
                              ? earned.total - previous.total
                              : null;

                      const pending = dominantTotal(commission.pending);

                      return {
                          key: "commission",
                          label: t("pages.dashboard.personal.stats.commission"),
                          value: earned
                              ? money(earned.total, earned.currency)
                              : "—",
                          sub: t(
                              "pages.dashboard.personal.stats.earned_this_month",
                          ),
                          ratio: commission.pending.length
                              ? `${pending.label}${pending.rest ? ` ${pending.rest}` : ""} ${t("pages.dashboard.personal.stats.still_pending")}`
                              : t(
                                    "pages.dashboard.personal.stats.commission_empty_ratio",
                                ),
                          ...(earned
                              ? {
                                    chip:
                                        delta === null || delta === 0
                                            ? t(
                                                  "pages.dashboard.personal.stats.no_change",
                                              )
                                            : `${delta > 0 ? "+" : "−"}${money(Math.abs(delta), earned.currency)} ${t("pages.dashboard.personal.stats.vs_last")}`,
                                    tone:
                                        delta === null || delta === 0
                                            ? ("flat" as const)
                                            : delta > 0
                                              ? ("up" as const)
                                              : ("down" as const),
                                    href: route("mlm.agent.commissions", {
                                        status: "paid",
                                        date_from: dayjs()
                                            .startOf("month")
                                            .format("YYYY-MM-DD"),
                                        date_to: dayjs()
                                            .endOf("month")
                                            .format("YYYY-MM-DD"),
                                    }),
                                }
                              : {}),
                      };
                  })(),
        [commission, t],
    );

    const showCommissionSlot = commission !== null;

    const leadsLabel = t("pages.dashboard.personal.stats.leads");
    const dealsLabel = t("pages.dashboard.personal.stats.deals");
    const meetingsLabel = t("pages.dashboard.personal.stats.meetings");
    const commissionLabel = t("pages.dashboard.personal.stats.commission");

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 14,
            }}
        >
            {leadsTile ? (
                <StatCard tile={leadsTile} />
            ) : (
                <StatCardSkeleton label={leadsLabel} />
            )}
            {dealsTile ? (
                <StatCard tile={dealsTile} />
            ) : (
                <StatCardSkeleton label={dealsLabel} />
            )}
            <Deferred
                data="stats"
                fallback={<StatCardSkeleton label={meetingsLabel} />}
            >
                {meetingsTile ? (
                    <StatCard tile={meetingsTile} />
                ) : (
                    <StatCardSkeleton label={meetingsLabel} />
                )}
            </Deferred>
            {showCommissionSlot &&
                (commissionTile ? (
                    <StatCard tile={commissionTile} />
                ) : (
                    <StatCardSkeleton label={commissionLabel} />
                ))}
        </div>
    );
}

function StatCard({ tile }: { tile: Tile }) {
    return (
        <div
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                padding: "13px 15px",
            }}
        >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span
                    style={{
                        fontSize: 12.5,
                        color: T.TEXT_MUTED,
                        whiteSpace: "nowrap",
                    }}
                >
                    {tile.label}
                </span>
                {tile.chip && tile.href && tile.tone && (
                    <FilterBadge
                        href={tile.href}
                        variant={CHIP_VARIANT[tile.tone]}
                        style={{ marginLeft: "auto" }}
                    >
                        {tile.chip}
                    </FilterBadge>
                )}
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
                        whiteSpace: "nowrap",
                    }}
                >
                    {tile.value}
                </span>
                {tile.sub && (
                    <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                        {tile.sub}
                    </span>
                )}
            </div>

            <p style={{ margin: "8px 0 0", fontSize: 12, color: T.TEXT_MUTED }}>
                {tile.ratio}
            </p>
        </div>
    );
}

/**
 * The real label stays static text — it's not data, it's the identity of the
 * slot, known before any request resolves. Only the parts that are actually
 * data (the chip, the value, the context line) shimmer.
 */
function StatCardSkeleton({ label }: { label: string }) {
    return (
        <div
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                padding: "13px 15px",
            }}
        >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span
                    style={{
                        fontSize: 12.5,
                        color: T.TEXT_MUTED,
                        whiteSpace: "nowrap",
                    }}
                >
                    {label}
                </span>
                <div
                    aria-hidden
                    className="dr-skeleton"
                    style={{
                        height: 20,
                        width: 56,
                        borderRadius: 999,
                        marginLeft: "auto",
                    }}
                />
            </div>
            <div
                aria-hidden
                className="dr-skeleton"
                style={{
                    height: 24,
                    width: "58%",
                    borderRadius: 6,
                    marginTop: 9,
                }}
            />
            <div
                aria-hidden
                className="dr-skeleton"
                style={{
                    height: 12,
                    width: "80%",
                    borderRadius: 6,
                    marginTop: 12,
                }}
            />
        </div>
    );
}
