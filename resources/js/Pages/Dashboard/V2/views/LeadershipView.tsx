import { useMemo } from "react";
import { Deferred } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "../components/DashboardPanel";
import StatTile from "../components/StatTile";
import MultiStatTile, { SegmentSkeleton } from "../components/MultiStatTile";
import MonthlyBarStrips, {
    type MonthlyStrip,
} from "../components/MonthlyBarStrips";
import SourceBreakdown, {
    type SourceBreakdownRow,
} from "../components/SourceBreakdown";
import { amount, figure, money } from "../format";
import type { DashboardRange } from "../viewConfig";
import type {
    CommissionTrend,
    CompanyHeadline,
    CompanyCommission,
    CompanyForecast,
    CurrencyTotal,
    RevenueTrend,
    WonRevenue,
} from "../types";

export interface LeadershipViewProps {
    wonRevenue?: WonRevenue;
    pipelineValue?: CurrencyTotal[];
    companyCommission?: CompanyCommission;
    companyForecast?: CompanyForecast;
    revenueTrend?: RevenueTrend;
    commissionTrend?: CommissionTrend;
    companyHeadline?: CompanyHeadline;
    sourceBreakdown?: SourceBreakdownRow[];
    range?: DashboardRange;
}

/**
 * The big picture a leadership team reads, in the order they read it:
 *  1. Outcomes — revenue won, deals won, average deal size, the open book.
 *  2. The engine behind them — demand, win rate, time to close, the sales
 *     network.
 *  3. Movement and cost — revenue by month; commission paid, owed and
 *     forecast.
 *  4. Where won business comes from, by lead source.
 *
 * Operational detail (meetings, response times, per-agent load) lives on the
 * manager and team views. Aggregate only, by design: no agent name or
 * per-agent row is computed for this view at all.
 *
 * Revenue and commission are in the company currency, each deal converted
 * by its own snapshotted exchange rate. The open pipeline stays per currency.
 * Every panel is its own deferred group with its own skeleton; the forecast
 * is isolated so a slow commission engine cannot hold up the rest.
 */
export default function LeadershipView({
    wonRevenue,
    pipelineValue,
    companyCommission,
    companyForecast,
    revenueTrend,
    commissionTrend,
    companyHeadline,
    sourceBreakdown,
    range,
}: LeadershipViewProps) {
    const { t } = useTranslation();

    const revenueStrips = useMemo<MonthlyStrip[]>(
        () =>
            revenueTrend
                ? [
                      {
                          key: "revenue",
                          label: t("pages.dashboard.company.revenue_title"),
                          color: T.GREEN,
                          points: revenueTrend.points.map((point) => ({
                              label: point.label,
                              value: point.total,
                          })),
                          format: (value: number) =>
                              amount(value, revenueTrend.currency),
                      },
                  ]
                : [],
        [revenueTrend, t],
    );

    const commissionStrips = useMemo<MonthlyStrip[]>(
        () =>
            commissionTrend
                ? [
                      {
                          key: "paid",
                          label: t("pages.dashboard.company.commission_paid"),
                          color: T.BLUE,
                          points: commissionTrend.points.map((point) => ({
                              label: point.label,
                              value: point.amount,
                          })),
                          format: (value: number) =>
                              amount(value, commissionTrend.currency),
                      },
                  ]
                : [],
        [commissionTrend, t],
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={tileGrid}>
                <Deferred
                    data="wonRevenue"
                    fallback={
                        <>
                            <CardSkeleton height={116} />
                            <CardSkeleton height={116} />
                            <CardSkeleton height={116} />
                        </>
                    }
                >
                    {wonRevenue ? (
                        <>
                            <RevenueTile revenue={wonRevenue} />
                            <DealsWonTile revenue={wonRevenue} />
                            <AverageDealTile revenue={wonRevenue} />
                        </>
                    ) : (
                        <span />
                    )}
                </Deferred>

                <Deferred
                    data="pipelineValue"
                    fallback={<CardSkeleton height={116} />}
                >
                    <PipelineTile rows={pipelineValue ?? []} />
                </Deferred>
            </div>

            <Deferred
                data="companyHeadline"
                fallback={
                    <div style={tileGrid}>
                        {Array.from({ length: 4 }).map((_, index) => (
                            <CardSkeleton key={index} height={116} />
                        ))}
                    </div>
                }
            >
                {companyHeadline ? (
                    <EngineTiles headline={companyHeadline} />
                ) : (
                    <span />
                )}
            </Deferred>

            <Deferred
                data="companyCommission"
                fallback={<CardSkeleton height={112} />}
            >
                {companyCommission ? (
                    <CommissionTile
                        commission={companyCommission}
                        forecast={companyForecast}
                    />
                ) : (
                    <span />
                )}
            </Deferred>

            <div style={twoColumns}>
                <DashboardPanel
                    localize={false}
                    title={t("pages.dashboard.company.revenue_trend_title")}
                    note={t("pages.dashboard.company.revenue_trend_note")}
                    style={{ height: "100%" }}
                >
                    <Deferred
                        data="revenueTrend"
                        fallback={<PanelSkeleton rows={5} />}
                    >
                        <MonthlyBarStrips
                            height={160}
                            strips={revenueStrips}
                            emptyMessage={t(
                                "pages.dashboard.company.revenue_trend_empty",
                            )}
                        />
                    </Deferred>
                </DashboardPanel>

                <DashboardPanel
                    localize={false}
                    title={t("pages.dashboard.company.commission_trend_title")}
                    note={t("pages.dashboard.company.commission_trend_note")}
                    style={{ height: "100%" }}
                >
                    <Deferred
                        data="commissionTrend"
                        fallback={<PanelSkeleton rows={5} />}
                    >
                        <MonthlyBarStrips
                            height={160}
                            strips={commissionStrips}
                            emptyMessage={t(
                                "pages.dashboard.company.commission_trend_empty",
                            )}
                        />
                    </Deferred>
                </DashboardPanel>
            </div>

            <DashboardPanel
                localize={false}
                flush
                title={t("pages.dashboard.company.sources_title")}
                note={t("pages.dashboard.company.sources_note")}
            >
                <div style={{ padding: "6px 18px 10px" }}>
                    <Deferred
                        data="sourceBreakdown"
                        fallback={<PanelSkeleton rows={5} />}
                    >
                        <SourceBreakdown
                            showWon
                            rows={sourceBreakdown ?? []}
                            from={range?.from}
                            to={range?.to}
                        />
                    </Deferred>
                </div>
            </DashboardPanel>
        </div>
    );
}

/** Revenue won in the window, against the window before it. */
function RevenueTile({ revenue }: { revenue: WonRevenue }) {
    const { t } = useTranslation();
    const { currency, total, previous, deal_count } = revenue;

    return (
        <StatTile
            localize={false}
            label={t("pages.dashboard.company.revenue_title")}
            hint={t("pages.dashboard.company.revenue_hint")}
            tone="green"
            value={deal_count || previous ? total : null}
            previous={previous}
            formatValue={(value) => amount(value, currency)}
            note={
                !deal_count && !previous
                    ? t("pages.dashboard.company.revenue_none")
                    : previous !== null
                      ? t("pages.dashboard.company.previous_period", {
                            amount: amount(previous, currency),
                        })
                      : null
            }
        />
    );
}

function DealsWonTile({ revenue }: { revenue: WonRevenue }) {
    const { t } = useTranslation();

    return (
        <StatTile
            localize={false}
            label={t("pages.dashboard.company.deals_won_title")}
            tone="green"
            value={revenue.deal_count}
            previous={revenue.previous_count}
            note={
                revenue.previous_count !== null
                    ? t("pages.dashboard.company.previous_period", {
                          amount: figure(revenue.previous_count),
                      })
                    : null
            }
        />
    );
}

/** Revenue over deals won — blank rather than zero when nothing was won. */
function AverageDealTile({ revenue }: { revenue: WonRevenue }) {
    const { t } = useTranslation();
    const { currency, total, deal_count, previous, previous_count } = revenue;
    const before =
        previous !== null && previous_count ? previous / previous_count : null;

    return (
        <StatTile
            localize={false}
            label={t("pages.dashboard.company.avg_deal_title")}
            hint={t("pages.dashboard.company.avg_deal_hint")}
            value={deal_count ? total / deal_count : null}
            previous={before}
            formatValue={(value) => amount(value, currency)}
            note={
                before !== null
                    ? t("pages.dashboard.company.previous_period", {
                          amount: amount(before, currency),
                      })
                    : null
            }
        />
    );
}

/** Demand, conversion, speed and the sales force — counts only. */
function EngineTiles({ headline }: { headline: CompanyHeadline }) {
    const { t } = useTranslation();
    const { new_leads, win_rate, days_to_win, agents } = headline;
    const days = (value: number) =>
        t("pages.dashboard.company.days_value", { days: figure(value) });

    return (
        <div style={tileGrid}>
            <StatTile
                localize={false}
                label={t("pages.dashboard.company.new_leads_title")}
                hint={t("pages.dashboard.company.new_leads_hint")}
                value={new_leads.value}
                previous={new_leads.previous}
                note={
                    new_leads.previous !== null
                        ? t("pages.dashboard.company.previous_period", {
                              amount: figure(new_leads.previous),
                          })
                        : null
                }
            />
            <StatTile
                localize={false}
                label={t("pages.dashboard.company.win_rate_title")}
                hint={t("pages.dashboard.company.win_rate_hint")}
                unit="%"
                tone="green"
                value={win_rate.value}
                previous={win_rate.previous}
                note={t("pages.dashboard.company.win_rate_note", {
                    won: figure(win_rate.won),
                    lost: figure(win_rate.lost),
                })}
            />
            <StatTile
                localize={false}
                label={t("pages.dashboard.company.days_to_win_title")}
                hint={t("pages.dashboard.company.days_to_win_hint")}
                lowerIsBetter
                value={days_to_win.value}
                previous={days_to_win.previous}
                formatValue={days}
                note={
                    days_to_win.previous !== null
                        ? t("pages.dashboard.company.previous_days", {
                              days: figure(days_to_win.previous),
                          })
                        : null
                }
            />
            <StatTile
                localize={false}
                label={t("pages.dashboard.company.agents_title")}
                hint={t("pages.dashboard.company.agents_hint")}
                value={agents.active}
                note={t("pages.dashboard.company.agents_joined", {
                    count: figure(agents.joined),
                })}
            />
        </div>
    );
}

/** Open book today: busiest currency first, the others named beside it. */
function PipelineTile({ rows }: { rows: CurrencyTotal[] }) {
    const { t } = useTranslation();
    const [lead, ...others] = [...rows].sort(
        (a, b) => b.deal_count - a.deal_count,
    );

    if (!lead) {
        return (
            <StatTile
                localize={false}
                label={t("pages.dashboard.company.pipeline_title")}
                hint={t("pages.dashboard.company.pipeline_hint")}
                value={null}
                note={t("pages.dashboard.company.pipeline_none")}
            />
        );
    }

    const dealCount = rows.reduce((sum, row) => sum + row.deal_count, 0);
    const notes = [
        t("pages.dashboard.company.pipeline_deals", {
            count: figure(dealCount),
        }),
        others.length
            ? t("pages.dashboard.company.revenue_other", {
                  amounts: others
                      .map((row) => money(row.total, row.currency.toUpperCase()))
                      .join(", "),
              })
            : null,
    ].filter(Boolean);

    return (
        <StatTile
            localize={false}
            label={t("pages.dashboard.company.pipeline_title")}
            hint={t("pages.dashboard.company.pipeline_hint")}
            value={money(lead.total, lead.currency.toUpperCase())}
            note={notes.join(" · ")}
        />
    );
}

/**
 * Paid, owed and forecast as one card — the cost side of the revenue above.
 * Same reading as the team view's earnings tile: company currency, System and
 * reverted legs never counted. The forecast fills in from its own deferred
 * prop.
 */
function CommissionTile({
    commission,
    forecast,
}: {
    commission: CompanyCommission;
    forecast?: CompanyForecast;
}) {
    const { t } = useTranslation();
    const currency = commission.currency;

    const notes = [
        commission.previous_paid !== null
            ? t("pages.dashboard.company.commission_previous", {
                  amount: amount(commission.previous_paid, currency),
              })
            : null,
        commission.reverted > 0
            ? t("pages.dashboard.company.commission_reverted", {
                  amount: amount(commission.reverted, currency),
              })
            : null,
        !forecast
            ? null
            : forecast.open_deals === 0
              ? t("pages.dashboard.company.forecast_none")
              : forecast.truncated
                ? t("pages.dashboard.company.forecast_sampled", {
                      count: forecast.deal_count,
                      total: figure(forecast.open_deals),
                  })
                : t("pages.dashboard.company.forecast_deals", {
                      count: forecast.deal_count,
                  }),
    ].filter(Boolean);

    return (
        <MultiStatTile
            localize={false}
            label={t("pages.dashboard.company.commission_title")}
            hint={t("pages.dashboard.company.commission_hint")}
            note={notes.length ? notes.join(" ") : null}
            segments={[
                {
                    label: t("pages.dashboard.company.commission_paid"),
                    value: amount(commission.paid, currency),
                    tone: "green",
                },
                {
                    label: t("pages.dashboard.company.commission_pending"),
                    value: amount(commission.pending, currency),
                    tone: "amber",
                },
                {
                    label: t("pages.dashboard.company.commission_forecast"),
                    value: (
                        <Deferred
                            data="companyForecast"
                            fallback={<SegmentSkeleton />}
                        >
                            {forecast ? (
                                amount(forecast.amount, forecast.currency)
                            ) : (
                                <SegmentSkeleton />
                            )}
                        </Deferred>
                    ),
                },
            ]}
        />
    );
}

const tileGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
    gap: 12,
} as const;

const twoColumns = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
    gap: 14,
    alignItems: "stretch",
} as const;
