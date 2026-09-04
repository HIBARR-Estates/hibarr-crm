import dayjs from "dayjs";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { CommissionSummary, PersonalStats, PipelineRow } from "./types";
import { dominantTotal, mergeCurrencyTotals, money } from "./format";
import FilterBadge from "./FilterBadge";

type Tone = "up" | "down" | "flat";

interface Tile {
    key: string;
    /** English source strings throughout — translated at the render site. */
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
    stats,
    pipelines,
    commission,
}: StatStripProps) {
    const { td } = useTd();
    const lookBack = `${td("last")} ${windowDays} ${td("days")}`;
    const lookAhead = `${td("next")} ${windowDays} ${td("days")}`;

    const leadsTile: Tile | undefined = stats
        ? (() => {
              const { leads } = stats;

              return {
                  key: "leads",
                  label: "Leads",
                  value: `${leads.new} ${td("new")}`,
                  sub: lookBack,
                  ratio: leads.new
                      ? `${leads.contacted} ${td("of")} ${leads.new} ${td("contacted")}`
                      : "New enquiries land here as they arrive",
                  // Only when there's actually someone uncontacted to filter
                  // to — "all contacted" is good news, not a click.
                  ...(leads.uncontacted
                      ? {
                            chip: `${leads.uncontacted} ${td("uncontacted")}`,
                            tone: "down" as const,
                            href: route("lead-contact.index", {
                                lead_owner_id: userId,
                                contact_status: "uncontacted",
                            }),
                        }
                      : {}),
              };
          })()
        : undefined;

    const dealsTile: Tile | undefined = pipelines
        ? (() => {
              const open = pipelines.reduce((sum, p) => sum + p.deal_count, 0);
              const idle = pipelines.reduce((sum, p) => sum + p.idle_count, 0);
              // Merged across pipelines — the true sum in the dominant
              // currency, not just whichever pipeline sorts first.
              const totals = mergeCurrencyTotals(
                  pipelines.flatMap((p) => p.totals),
              );

              return {
                  key: "deals",
                  label: "Deals",
                  value: `${open} ${td("open")}`,
                  // Empty when nothing carries a nameable currency — the count
                  // is still true, and a number with no unit on it is not.
                  sub: open && totals.length ? dominantTotal(totals).label : "",
                  ratio: open
                      ? `${td("across")} ${pipelines.length} ${pipelines.length === 1 ? td("pipeline") : td("pipelines")}`
                      : "Convert a lead and the deal appears here",
                  // Only when there's an idle deal to filter to — "none idle"
                  // is good news, not a click.
                  ...(idle
                      ? {
                            // "Idle" alone reads as a state, not a duration —
                            // say what the threshold actually is, matching
                            // PipelineSplit's own "no activity in 7 days"
                            // wording below.
                            chip: `${idle} ${td("idle for")} ${IDLE_DAYS}+ ${td("days")}`,
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
        : undefined;

    const meetingsTile: Tile | undefined = stats
        ? (() => {
              const { meetings } = stats;
              const logged = meetings.attended + meetings.missed;

              return {
                  key: "meetings",
                  label: "Meetings",
                  value: `${meetings.upcoming} ${td("upcoming")}`,
                  sub: lookAhead,
                  // Reads what already happened, not what's still ahead —
                  // attendance is logged after the fact (see "Log attendance"
                  // on a held meeting), so a meeting with nothing logged yet
                  // is unknown, not missed.
                  ratio: logged
                      ? `${meetings.attended} ${td("attended")} · ${meetings.missed} ${td("missed")}`
                      : "Nothing logged in this window yet",
                  // Only when there's a miss to flag — "none missed" is good
                  // news, not a click worth offering.
                  ...(meetings.missed
                      ? {
                            chip: `${meetings.missed} ${td("missed")}`,
                            tone: "down" as const,
                            href: route("meetings.index"),
                        }
                      : {}),
              };
          })()
        : undefined;

    // Agents only. A non-agent account has no lead_agent record and so no
    // commission at all — the server sends null and the slot is dropped.
    const commissionTile: Tile | undefined =
        commission == null
            ? undefined
            : (() => {
                  const earned = commission.earned[0];
                  const previous = commission.previous.find(
                      (row) => row.currency === earned?.currency,
                  );
                  const delta =
                      earned && previous ? earned.total - previous.total : null;

                  const pending = dominantTotal(commission.pending);

                  return {
                      key: "commission",
                      label: "Commission",
                      // The server drops totals it can't name, so `earned` is
                      // either a real figure in a real currency or absent.
                      value: earned ? money(earned.total, earned.currency) : "—",
                      sub: "earned this month",
                      // Pending is its own currency split, independent of
                      // what (if anything) was earned this month — an agent
                      // can have nothing paid out yet but plenty booked.
                      ratio: commission.pending.length
                          ? `${pending.label}${pending.rest ? ` ${pending.rest}` : ""} ${td("still pending")}`
                          : "Nothing pending right now",
                      // Only when there's something paid this month to look
                      // at — with nothing earned, the destination is an
                      // empty list, not a click worth offering.
                      ...(earned
                          ? {
                                chip:
                                    delta === null || delta === 0
                                        ? "no change"
                                        : `${delta > 0 ? "+" : "−"}${money(Math.abs(delta), earned.currency)} ${td("vs last")}`,
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
              })();

    // null once resolved and inapplicable (no lead_agent record) — the only
    // slot allowed to disappear rather than sit in its skeleton forever.
    const showCommissionSlot = commission !== null;

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
                <StatCardSkeleton label="Leads" />
            )}
            {dealsTile ? (
                <StatCard tile={dealsTile} />
            ) : (
                <StatCardSkeleton label="Deals" />
            )}
            {meetingsTile ? (
                <StatCard tile={meetingsTile} />
            ) : (
                <StatCardSkeleton label="Meetings" />
            )}
            {showCommissionSlot &&
                (commissionTile ? (
                    <StatCard tile={commissionTile} />
                ) : (
                    <StatCardSkeleton label="Commission" />
                ))}
        </div>
    );
}

function StatCard({ tile }: { tile: Tile }) {
    const { td } = useTd();

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
                    {td(tile.label)}
                </span>
                {tile.chip && tile.href && tile.tone && (
                    <FilterBadge
                        href={tile.href}
                        variant={CHIP_VARIANT[tile.tone]}
                        style={{ marginLeft: "auto" }}
                    >
                        {td(tile.chip)}
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
                        {td(tile.sub)}
                    </span>
                )}
            </div>

            <p style={{ margin: "8px 0 0", fontSize: 12, color: T.TEXT_MUTED }}>
                {td(tile.ratio)}
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
    const { td } = useTd();

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
                    {td(label)}
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
