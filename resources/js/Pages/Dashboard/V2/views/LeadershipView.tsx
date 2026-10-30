import { Deferred } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "../components/DashboardPanel";
import HeadlineFigure from "../components/HeadlineFigure";
import CommissionTrendChart from "../components/CommissionTrendChart";
import type { SourceBreakdownRow } from "../components/SourceBreakdown";
import { amount, figure, money } from "../format";
import type {
    CompanyCommission,
    CompanyForecast,
    CompanyHeadline,
    CurrencyTotal,
    RevenueTrend,
    WonRevenue,
} from "../types";

export interface LeadershipViewProps {
    wonRevenue?: WonRevenue;
    revenueTrend?: RevenueTrend;
    pipelineValue?: CurrencyTotal[];
    companyCommission?: CompanyCommission;
    companyForecast?: CompanyForecast;
    companyHeadline?: CompanyHeadline;
    sourceBreakdown?: SourceBreakdownRow[];
}

/** Sources shown: the few that matter, not the whole channel list. */
const TOP_SOURCES = 3;

/**
 * The big picture, with one number leading.
 *
 *  1. Revenue won — the hero, with its month-by-month line beside it.
 *  2. Three supporting cards: what could close next (open pipeline), how
 *     well deals convert (win rate), and what selling cost (commission).
 *  3. One quiet strip for growth and efficiency: demand, time to close,
 *     average deal, the sales network.
 *  4. The few lead sources won business actually came from.
 *
 * Fewer, larger numbers by design: everything else a leadership team might
 * ask for lives on the manager and team views. Aggregate only — no agent name
 * or per-agent row is computed for this view at all. Revenue and commission
 * are in the company currency; the open pipeline stays per currency.
 */
export default function LeadershipView({
    wonRevenue,
    revenueTrend,
    pipelineValue,
    companyCommission,
    companyForecast,
    companyHeadline,
    sourceBreakdown,
}: LeadershipViewProps) {
    const { t } = useTranslation();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <DashboardPanel>
                <div className="dv2-company-hero">
                    <Deferred
                        data="wonRevenue"
                        fallback={<PanelSkeleton rows={3} />}
                    >
                        {wonRevenue ? <RevenueHero revenue={wonRevenue} /> : <span />}
                    </Deferred>

                    <div style={{ minWidth: 0 }}>
                        <Deferred
                            data="revenueTrend"
                            fallback={<CardSkeleton height={150} />}
                        >
                            {revenueTrend ? (
                                <RevenueLine trend={revenueTrend} />
                            ) : (
                                <span />
                            )}
                        </Deferred>
                    </div>
                </div>
            </DashboardPanel>

            <div style={cardGrid}>
                <Deferred
                    data="pipelineValue"
                    fallback={<CardSkeleton height={112} />}
                >
                    <DashboardPanel style={{ height: "100%" }}>
                        <PipelineFigure rows={pipelineValue ?? []} />
                    </DashboardPanel>
                </Deferred>

                <Deferred
                    data="companyHeadline"
                    fallback={<CardSkeleton height={112} />}
                >
                    <DashboardPanel style={{ height: "100%" }}>
                        {companyHeadline ? (
                            <HeadlineFigure
                                label={t("pages.dashboard.company.win_rate_title")}
                                hint={t("pages.dashboard.company.win_rate_hint")}
                                value={
                                    companyHeadline.win_rate.value === null
                                        ? null
                                        : `${figure(Math.round(companyHeadline.win_rate.value))}%`
                                }
                                change={{
                                    kind: "points",
                                    current: companyHeadline.win_rate.value,
                                    previous: companyHeadline.win_rate.previous,
                                }}
                                note={t("pages.dashboard.company.win_rate_note", {
                                    won: figure(companyHeadline.win_rate.won),
                                    lost: figure(companyHeadline.win_rate.lost),
                                })}
                            />
                        ) : (
                            <span />
                        )}
                    </DashboardPanel>
                </Deferred>

                <Deferred
                    data="companyCommission"
                    fallback={<CardSkeleton height={112} />}
                >
                    <DashboardPanel style={{ height: "100%" }}>
                        {companyCommission ? (
                            <CommissionFigure
                                commission={companyCommission}
                                forecast={companyForecast}
                            />
                        ) : (
                            <span />
                        )}
                    </DashboardPanel>
                </Deferred>
            </div>

            <Deferred
                data={["companyHeadline", "wonRevenue"]}
                fallback={<CardSkeleton height={96} />}
            >
                {companyHeadline && wonRevenue ? (
                    <GrowthStrip headline={companyHeadline} revenue={wonRevenue} />
                ) : (
                    <span />
                )}
            </Deferred>

            <DashboardPanel
                localize={false}
                title={t("pages.dashboard.company.sources_title")}
                note={t("pages.dashboard.company.sources_note")}
            >
                <Deferred
                    data="sourceBreakdown"
                    fallback={<PanelSkeleton rows={2} />}
                >
                    <TopSources rows={sourceBreakdown ?? []} />
                </Deferred>
            </DashboardPanel>
        </div>
    );
}

function RevenueHero({ revenue }: { revenue: WonRevenue }) {
    const { t } = useTranslation();
    const { currency, total, deal_count, previous } = revenue;
    const nothing = !deal_count && !previous;

    return (
        <HeadlineFigure
            size="hero"
            label={t("pages.dashboard.company.revenue_title")}
            hint={t("pages.dashboard.company.revenue_hint")}
            value={nothing ? null : amount(total, currency)}
            change={{ kind: "relative", current: total, previous }}
            note={
                nothing
                    ? t("pages.dashboard.company.revenue_none")
                    : previous !== null
                      ? t("pages.dashboard.company.revenue_note", {
                            previous: amount(previous, currency),
                            count: figure(deal_count),
                        })
                      : t("pages.dashboard.company.revenue_note_all", {
                            count: figure(deal_count),
                        })
            }
        />
    );
}

/** The hero's shape over time — same chart the team view's commission uses. */
function RevenueLine({ trend }: { trend: RevenueTrend }) {
    const { t } = useTranslation();

    if (!trend.points.some((point) => point.total > 0)) {
        return null;
    }

    return (
        <>
            <CommissionTrendChart
                height={150}
                legend={false}
                seriesLabel={t("pages.dashboard.company.revenue_title")}
                ariaLabel={t("pages.dashboard.company.revenue_trend_caption")}
                data={{
                    currency: trend.currency,
                    points: trend.points.map((point) => ({
                        period: point.period,
                        label: point.label,
                        amount: point.total,
                    })),
                }}
            />
            <div
                style={{
                    textAlign: "right",
                    fontSize: 12,
                    color: T.TEXT_HINT,
                    marginTop: 2,
                }}
            >
                {t("pages.dashboard.company.revenue_trend_caption")}
            </div>
        </>
    );
}

/** Busiest currency first; the others named, never added to it. */
function PipelineFigure({ rows }: { rows: CurrencyTotal[] }) {
    const { t } = useTranslation();
    const [lead, ...others] = [...rows].sort(
        (a, b) => b.deal_count - a.deal_count,
    );
    const dealCount = rows.reduce((sum, row) => sum + row.deal_count, 0);

    return (
        <HeadlineFigure
            label={t("pages.dashboard.company.pipeline_title")}
            hint={t("pages.dashboard.company.pipeline_hint")}
            value={lead ? money(lead.total, lead.currency.toUpperCase()) : null}
            chip={
                lead ? (
                    <span
                        className="dr-pill dr-pill-amber"
                        style={{ fontSize: 12 }}
                    >
                        {t("pages.dashboard.company.pipeline_deals", {
                            count: figure(dealCount),
                        })}
                    </span>
                ) : null
            }
            note={
                !lead
                    ? t("pages.dashboard.company.pipeline_none")
                    : others.length
                      ? t("pages.dashboard.company.pipeline_other", {
                            amounts: others
                                .map((row) =>
                                    money(row.total, row.currency.toUpperCase()),
                                )
                                .join(", "),
                        })
                      : t("pages.dashboard.company.pipeline_note")
            }
        />
    );
}

/**
 * Paid leads; what is still owed and what the open book would add are the
 * one line under it. The forecast fills in from its own deferred prop, and the
 * hint says when it only priced a sample of the open deals.
 */
function CommissionFigure({
    commission,
    forecast,
}: {
    commission: CompanyCommission;
    forecast?: CompanyForecast;
}) {
    const { t } = useTranslation();
    const { currency } = commission;
    const owed = amount(commission.pending, currency);

    const hint = [
        t("pages.dashboard.company.commission_hint"),
        forecast?.truncated
            ? t("pages.dashboard.company.forecast_sampled", {
                  count: forecast.deal_count,
                  total: figure(forecast.open_deals),
              })
            : null,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <HeadlineFigure
            label={t("pages.dashboard.company.commission_title")}
            hint={hint}
            value={amount(commission.paid, currency)}
            change={{
                kind: "relative",
                current: commission.paid,
                previous: commission.previous_paid,
            }}
            note={
                forecast
                    ? t("pages.dashboard.company.commission_note", {
                          owed,
                          forecast: amount(forecast.amount, forecast.currency),
                      })
                    : t("pages.dashboard.company.commission_owed", { owed })
            }
        />
    );
}

/** Demand, speed, deal size and the sales force — small, on one line. */
function GrowthStrip({
    headline,
    revenue,
}: {
    headline: CompanyHeadline;
    revenue: WonRevenue;
}) {
    const { t } = useTranslation();
    const { new_leads, days_to_win, agents } = headline;
    const { currency, total, deal_count, previous, previous_count } = revenue;

    const average = deal_count ? total / deal_count : null;
    const averageBefore =
        previous !== null && previous_count ? previous / previous_count : null;

    return (
        <DashboardPanel>
            <div className="dv2-eyebrow" style={{ marginBottom: 12 }}>
                {t("pages.dashboard.company.growth_title")}
            </div>
            <div className="dv2-company-strip">
                <HeadlineFigure
                    size="compact"
                    label={t("pages.dashboard.company.new_leads_title")}
                    hint={t("pages.dashboard.company.new_leads_hint")}
                    value={new_leads.value === null ? null : figure(new_leads.value)}
                    change={{
                        kind: "relative",
                        current: new_leads.value,
                        previous: new_leads.previous,
                    }}
                />
                <HeadlineFigure
                    size="compact"
                    label={t("pages.dashboard.company.days_to_win_title")}
                    hint={t("pages.dashboard.company.days_to_win_hint")}
                    value={
                        days_to_win.value === null
                            ? null
                            : t("pages.dashboard.company.days_value", {
                                  days: figure(days_to_win.value),
                              })
                    }
                    change={{
                        kind: "days",
                        current: days_to_win.value,
                        previous: days_to_win.previous,
                        lowerIsBetter: true,
                    }}
                />
                <HeadlineFigure
                    size="compact"
                    label={t("pages.dashboard.company.avg_deal_title")}
                    hint={t("pages.dashboard.company.avg_deal_hint")}
                    value={average === null ? null : amount(average, currency)}
                    change={{
                        kind: "relative",
                        current: average,
                        previous: averageBefore,
                    }}
                />
                <HeadlineFigure
                    size="compact"
                    label={t("pages.dashboard.company.agents_title")}
                    hint={t("pages.dashboard.company.agents_hint")}
                    value={t("pages.dashboard.company.agents_value", {
                        count: figure(agents.active),
                    })}
                    chip={
                        agents.joined > 0 ? (
                            <span
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: T.GREEN,
                                }}
                            >
                                {t("pages.dashboard.company.agents_joined", {
                                    count: figure(agents.joined),
                                })}
                            </span>
                        ) : null
                    }
                />
            </div>
        </DashboardPanel>
    );
}

/**
 * The sources won business came from, ranked by the share of their leads
 * that became a won deal — conversion, not volume, is the leadership
 * question. Bars are scaled to the best of them.
 */
function TopSources({ rows }: { rows: SourceBreakdownRow[] }) {
    const { t } = useTranslation();

    const ranked = rows
        .filter((row) => row.count > 0)
        .map((row) => ({
            ...row,
            share: Math.round(((row.won ?? 0) / row.count) * 100),
        }))
        .sort((a, b) => b.share - a.share || b.count - a.count)
        .slice(0, TOP_SOURCES);

    if (!ranked.length) {
        return (
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                {t("pages.dashboard.company.sources_empty")}
            </p>
        );
    }

    const best = Math.max(...ranked.map((row) => row.share), 1);

    return (
        <div style={{ ...cardGrid, columnGap: 28 }}>
            {ranked.map((row) => (
                <div key={row.id} style={{ minWidth: 0 }}>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            fontSize: 14,
                        }}
                    >
                        <span
                            style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: T.TEXT,
                            }}
                        >
                            {row.name}
                        </span>
                        <span style={{ fontWeight: 700, color: T.NAVY }}>
                            {row.share}%
                        </span>
                    </div>
                    <div
                        style={{
                            height: 8,
                            marginTop: 6,
                            borderRadius: 4,
                            background: T.GRAY,
                        }}
                    >
                        <div
                            style={{
                                height: 8,
                                width: `${(row.share / best) * 100}%`,
                                minWidth: row.share > 0 ? 6 : 0,
                                borderRadius: 4,
                                background: T.BLUE,
                            }}
                        />
                    </div>
                    <div
                        style={{ marginTop: 4, fontSize: 12, color: T.TEXT_HINT }}
                    >
                        {t("pages.dashboard.company.sources_leads", {
                            count: figure(row.count),
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

const cardGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 14,
} as const;
