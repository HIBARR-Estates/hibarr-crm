import { useMemo, useState } from "react";
import { Deferred, Link } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "../components/DashboardPanel";
import StatTile from "../components/StatTile";
import MultiStatTile, { SegmentSkeleton } from "../components/MultiStatTile";
import TeamNetworkGraph, {
    type GraphSelection,
} from "../components/TeamNetworkGraph";
import CommissionTrendChart from "../components/CommissionTrendChart";
import NetworkGrowthChart from "../components/NetworkGrowthChart";
import RecentCommissionsList from "../components/RecentCommissionsList";
import { amount } from "../format";
import type {
    TeamCommissionTrend,
    TeamForecast,
    TeamGrowth,
    TeamRecentCommission,
    TeamSummary,
    TeamTree as TeamTreeData,
} from "../types";

export interface TeamViewProps {
    /** null for an account holding the permission but no lead_agent record. */
    teamSummary?: TeamSummary | null;
    teamForecast?: TeamForecast | null;
    teamTree?: TeamTreeData | null;
    teamCommissionTrend?: TeamCommissionTrend | null;
    teamGrowth?: TeamGrowth | null;
    teamRecentCommissions?: TeamRecentCommission[] | null;
    /** Days the window covers, for copy. The picker owns the window itself. */
    period?: number;
}

/**
 * Your network, and nothing of your own — a single place to read what
 * everyone below you is doing: who they are, what they're working, and what
 * they're earning.
 *
 * Every figure covers the agents below you at any depth and excludes you. A
 * team lead reading this is asking how their people are doing, and folding
 * their own book into the totals is the fastest way to make that unreadable —
 * a strong personal closer can hide an idle network completely.
 *
 * Commission comes from mlm_commissions as MlmCommissionService wrote it, or
 * that same service's preview() for the forecast. The page does no commission
 * arithmetic of its own, so it can never disagree with an agent's own
 * commission screen.
 *
 * Copy is resolved from pages.dashboard.team.* lang keys via t() — not
 * dynamic translation — so German / Turkish / Russian ship from the locale files.
 */
export default function TeamView({
    teamSummary,
    teamForecast,
    teamTree,
    teamCommissionTrend,
    teamGrowth,
    teamRecentCommissions,
    period = 30,
}: TeamViewProps) {
    const { t } = useTranslation();
    const [selected, setSelected] = useState<GraphSelection | null>(null);

    const earningsHint = useMemo(() => {
        const forecastTail = teamForecast?.truncated
            ? t("pages.dashboard.team.tiles.earnings_forecast_sampled")
            : teamForecast?.deal_count
              ? t("pages.dashboard.team.tiles.earnings_forecast_deals", {
                    count: teamForecast.deal_count,
                })
              : "";

        return t("pages.dashboard.team.tiles.earnings_hint", {
            period,
            forecast: forecastTail,
        });
    }, [period, t, teamForecast]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Deferred
                data="teamSummary"
                fallback={
                    <div className="team-stat-tiles">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <CardSkeleton key={index} height={100} />
                        ))}
                    </div>
                }
            >
                {teamSummary ? (
                    <div className="team-stat-tiles" data-tour="team-stat-tiles">
                        <StatTile
                            localize={false}
                            variant="team"
                            label={t("pages.dashboard.team.tiles.agents")}
                            value={teamSummary.agents}
                            hint={t("pages.dashboard.team.tiles.agents_hint", {
                                direct: teamSummary.direct_reports,
                                levels: teamSummary.generations,
                            })}
                        />

                        <MultiStatTile
                            localize={false}
                            variant="team"
                            label={t("pages.dashboard.team.tiles.deals")}
                            segments={[
                                {
                                    label: t("pages.dashboard.team.tiles.active"),
                                    value: teamSummary.active_deals,
                                },
                                {
                                    label: t("pages.dashboard.team.tiles.won"),
                                    value: teamSummary.deals_won,
                                    tone: "green",
                                },
                            ]}
                            hint={t("pages.dashboard.team.tiles.deals_hint", {
                                period,
                            })}
                        />

                        <MultiStatTile
                            localize={false}
                            variant="team"
                            label={t("pages.dashboard.team.tiles.leads")}
                            hint={t("pages.dashboard.team.tiles.leads_hint")}
                            segments={[
                                {
                                    label: t(
                                        "pages.dashboard.team.tiles.untouched",
                                    ),
                                    value: teamSummary.leads_untouched,
                                    tone:
                                        teamSummary.leads_untouched > 0
                                            ? "amber"
                                            : undefined,
                                },
                                {
                                    label: t(
                                        "pages.dashboard.team.tiles.contacted",
                                    ),
                                    value: teamSummary.leads_active,
                                },
                            ]}
                        />

                        <MultiStatTile
                            localize={false}
                            variant="team"
                            label={t("pages.dashboard.team.tiles.earnings")}
                            hint={earningsHint}
                            segments={[
                                {
                                    label: t("pages.dashboard.team.tiles.paid"),
                                    value: amount(
                                        teamSummary.paid,
                                        teamSummary.currency,
                                    ),
                                    tone: "green",
                                },
                                {
                                    label: t(
                                        "pages.dashboard.team.tiles.pending",
                                    ),
                                    value: amount(
                                        teamSummary.pending,
                                        teamSummary.currency,
                                    ),
                                    tone: "amber",
                                },
                                {
                                    label: t(
                                        "pages.dashboard.team.tiles.forecast",
                                    ),
                                    value: (
                                        <Deferred
                                            data="teamForecast"
                                            fallback={<SegmentSkeleton />}
                                        >
                                            {teamForecast ? (
                                                amount(
                                                    teamForecast.amount,
                                                    teamForecast.currency,
                                                )
                                            ) : (
                                                <SegmentSkeleton />
                                            )}
                                        </Deferred>
                                    ),
                                },
                            ]}
                        />
                    </div>
                ) : (
                    <NoAgentRecord />
                )}
            </Deferred>

            {/* Dropped once we know there is no agent record — the panels'
                own empty states would tell the same person the same thing
                three times over. */}
            {teamSummary !== null && (
                <>
                    <DashboardPanel
                        localize={false}
                        flush
                        dataTour="team-network"
                        title={t("pages.dashboard.team.panels.network_title")}
                        note={t("pages.dashboard.team.panels.network_note")}
                        footerTone={selected ? "raised" : "sunken"}
                        footer={
                            <NodeDetail
                                selection={selected}
                                currency={teamTree?.currency ?? null}
                                period={period}
                                networkSummary={teamSummary}
                                networkForecast={teamForecast}
                            />
                        }
                    >
                        <Deferred
                            data="teamTree"
                            fallback={
                                <div style={{ padding: 18 }}>
                                    <PanelSkeleton rows={8} />
                                </div>
                            }
                        >
                            {teamTree ? (
                                <TeamNetworkGraph
                                    data={teamTree}
                                    onSelect={setSelected}
                                    networkSummary={teamSummary}
                                />
                            ) : (
                                <span />
                            )}
                        </Deferred>
                    </DashboardPanel>

                    {/* Paired side by side — both are month-by-month charts
                        over the same window, read the same way, so they
                        belong next to each other rather than stacked. */}
                    <div
                        data-tour="team-charts"
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
                            gap: 14,
                            alignItems: "start",
                        }}
                    >
                        <DashboardPanel
                            localize={false}
                            title={t(
                                "pages.dashboard.team.panels.commission_trend_title",
                            )}
                            note={t(
                                "pages.dashboard.team.panels.commission_trend_note",
                                { period },
                            )}
                        >
                            <Deferred
                                data="teamCommissionTrend"
                                fallback={<PanelSkeleton rows={6} />}
                            >
                                {teamCommissionTrend ? (
                                    <CommissionTrendChart
                                        data={teamCommissionTrend}
                                    />
                                ) : (
                                    <span />
                                )}
                            </Deferred>
                        </DashboardPanel>

                        <DashboardPanel
                            localize={false}
                            title={t(
                                "pages.dashboard.team.panels.network_growth_title",
                            )}
                            note={t(
                                "pages.dashboard.team.panels.network_growth_note",
                            )}
                        >
                            <Deferred
                                data="teamGrowth"
                                fallback={<PanelSkeleton rows={6} />}
                            >
                                {teamGrowth ? (
                                    <NetworkGrowthChart data={teamGrowth} />
                                ) : (
                                    <span />
                                )}
                            </Deferred>
                        </DashboardPanel>
                    </div>

                    <DashboardPanel
                        localize={false}
                        flush
                        dataTour="team-recent-commissions"
                        title={t(
                            "pages.dashboard.team.panels.recent_commissions_title",
                        )}
                        note={t(
                            "pages.dashboard.team.panels.recent_commissions_note",
                        )}
                    >
                        <Deferred
                            data="teamRecentCommissions"
                            fallback={
                                <div style={{ padding: 18 }}>
                                    <PanelSkeleton rows={5} />
                                </div>
                            }
                        >
                            {teamRecentCommissions ? (
                                <RecentCommissionsList
                                    rows={teamRecentCommissions}
                                    currency={teamSummary?.currency ?? null}
                                />
                            ) : (
                                <span />
                            )}
                        </Deferred>
                    </DashboardPanel>
                </>
            )}
        </div>
    );
}

/**
 * The graph's footer: nobody's numbers until somebody is clicked.
 *
 * A person shows their own figure against their whole branch's — the same
 * "own vs network" reading the card itself only has room to hint at. "You"
 * has no own figure to show — every number here already covers the whole
 * network — so it reads the same teamSummary / teamForecast the tile row
 * does rather than anything carried on the graph's data.
 */
function NodeDetail({
    selection,
    currency,
    period,
    networkSummary,
    networkForecast,
}: {
    selection: GraphSelection | null;
    currency: string | null;
    period: number;
    networkSummary?: TeamSummary | null;
    networkForecast?: TeamForecast | null;
}) {
    const { t } = useTranslation();

    if (!selection) {
        return (
            <span style={{ color: T.TEXT_MUTED }}>
                {t("pages.dashboard.team.detail.click_anyone")}
            </span>
        );
    }

    if (selection.kind === "you") {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                <div style={{ fontWeight: 700, color: T.NAVY }}>
                    {t("pages.dashboard.team.detail.your_whole_network")}
                </div>
                {networkSummary ? (
                    <>
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                columnGap: 18,
                                rowGap: 4,
                            }}
                        >
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {t("pages.dashboard.team.detail.active_deals")}
                                    :{" "}
                                </span>
                                <strong>{networkSummary.active_deals}</strong>
                            </span>
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {t("pages.dashboard.team.detail.won")}:{" "}
                                </span>
                                <strong>{networkSummary.deals_won}</strong>
                            </span>
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {t(
                                        "pages.dashboard.team.detail.contacted_leads",
                                    )}
                                    :{" "}
                                </span>
                                <strong>{networkSummary.leads_active}</strong>
                            </span>
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {t("pages.dashboard.team.detail.paid")}:{" "}
                                </span>
                                <strong>
                                    {amount(networkSummary.paid, currency)}
                                </strong>
                            </span>
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {t("pages.dashboard.team.detail.pending")}:{" "}
                                </span>
                                <strong>
                                    {amount(networkSummary.pending, currency)}
                                </strong>
                            </span>
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {t("pages.dashboard.team.detail.forecast")}:{" "}
                                </span>
                                <strong>
                                    <Deferred
                                        data="teamForecast"
                                        fallback={<SegmentSkeleton />}
                                    >
                                        {networkForecast ? (
                                            amount(
                                                networkForecast.amount,
                                                currency,
                                            )
                                        ) : (
                                            <SegmentSkeleton />
                                        )}
                                    </Deferred>
                                </strong>
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                            {t("pages.dashboard.team.detail.same_totals")}{" "}
                            {t("pages.dashboard.team.detail.won_paid_cover", {
                                period,
                            })}
                        </div>
                    </>
                ) : (
                    <span style={{ color: T.TEXT_MUTED }}>
                        {t("pages.dashboard.team.detail.loading_totals")}
                    </span>
                )}
            </div>
        );
    }

    const { node } = selection;

    const rows: Array<[string, number | string, number | string]> = [
        [
            t("pages.dashboard.team.detail.active_deals"),
            node.own.active_deals,
            node.network.active_deals,
        ],
        [
            t("pages.dashboard.team.detail.won"),
            node.own.deals_won,
            node.network.deals_won,
        ],
        [
            t("pages.dashboard.team.detail.contacted_leads"),
            node.own.leads_active,
            node.network.leads_active,
        ],
        [
            t("pages.dashboard.team.detail.paid"),
            amount(node.own.paid, currency),
            amount(node.network.paid, currency),
        ],
        [
            t("pages.dashboard.team.detail.pending"),
            amount(node.own.pending, currency),
            amount(node.network.pending, currency),
        ],
    ];

    const listFilters =
        node.user_id != null
            ? {
                  leads: route("lead-contact.index", {
                      lead_owner_id: node.user_id,
                  }),
                  deals: route("deals.index", {
                      agent_id: node.user_id,
                      outcome_status: "open",
                      lead_pipeline_id: "all",
                  }),
              }
            : null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                }}
            >
                <div style={{ fontWeight: 700, color: T.NAVY }}>
                    {node.name}
                    {node.level && (
                        <span style={{ fontWeight: 400, color: T.TEXT_MUTED }}>
                            {" · "}
                            {node.level}
                        </span>
                    )}
                </div>
                {listFilters && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <Link
                            href={listFilters.leads}
                            className="dr-btn dr-btn-ghost dr-btn-sm"
                        >
                            {t("pages.dashboard.team.detail.view_leads")}
                        </Link>
                        <Link
                            href={listFilters.deals}
                            className="dr-btn dr-btn-ghost dr-btn-sm"
                        >
                            {t("pages.dashboard.team.detail.view_deals")}
                        </Link>
                    </div>
                )}
            </div>
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    columnGap: 18,
                    rowGap: 4,
                }}
            >
                {rows.map(([label, own, branch]) => (
                    <span key={label}>
                        <span style={{ color: T.TEXT_HINT }}>{label}: </span>
                        <strong>{own}</strong>
                        {String(own) !== String(branch) && (
                            <span style={{ color: T.TEXT_HINT }}>
                                {" "}
                                (
                                {t(
                                    "pages.dashboard.team.detail.their_whole_branch",
                                )}
                                : {branch})
                            </span>
                        )}
                    </span>
                ))}
            </div>
            <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                {t("pages.dashboard.team.detail.won_paid_cover", { period })}{" "}
                {t("pages.dashboard.team.detail.as_of_now")}
            </div>
        </div>
    );
}

/**
 * A team lead can hold view_team_dashboard without holding a lead_agent record
 * — the permission is granted by role, the agent record is created per person.
 * Without one there is no network to read, and the view says so rather than
 * widening the query to everyone.
 */
function NoAgentRecord() {
    const { t } = useTranslation();

    return (
        <DashboardPanel>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                {t("pages.dashboard.team.no_agent.title")}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                {t("pages.dashboard.team.no_agent.body")}
            </p>
        </DashboardPanel>
    );
}
