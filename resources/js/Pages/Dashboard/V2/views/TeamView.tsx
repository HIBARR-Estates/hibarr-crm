import { useState } from "react";
import { Deferred } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
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
    const { td } = useTd();
    const [selected, setSelected] = useState<GraphSelection | null>(null);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Deferred
                data="teamSummary"
                fallback={
                    <div style={tileGrid}>
                        {Array.from({ length: 4 }).map((_, index) => (
                            <CardSkeleton key={index} height={116} />
                        ))}
                    </div>
                }
            >
                {teamSummary ? (
                    <div style={tileGrid}>
                        <StatTile
                            label="People in your network"
                            value={teamSummary.agents}
                            note={`${teamSummary.direct_reports} direct reports · ${teamSummary.generations} levels deep · you are not counted`}
                        />

                        <MultiStatTile
                            label="Deals"
                            segments={[
                                {
                                    label: "Active",
                                    value: teamSummary.active_deals,
                                },
                                {
                                    label: "Won",
                                    value: teamSummary.deals_won,
                                    tone: "green",
                                },
                            ]}
                            note={`Active counts every open deal in the network right now, regardless of when it started. Won is limited to the last ${period} days.`}
                        />

                        <StatTile
                            label="Leads in play"
                            value={teamSummary.leads_active}
                            note={
                                teamSummary.leads_untouched
                                    ? `Contacted and still open. ${teamSummary.leads_untouched} more have had no first contact at all.`
                                    : "Contacted and still open — nobody in the network has an untouched lead right now."
                            }
                        />

                        <MultiStatTile
                            label="Network earnings"
                            segments={[
                                {
                                    label: "Paid",
                                    value: amount(
                                        teamSummary.paid,
                                        teamSummary.currency,
                                    ),
                                    tone: "green",
                                },
                                {
                                    label: "Pending",
                                    value: amount(
                                        teamSummary.pending,
                                        teamSummary.currency,
                                    ),
                                    tone: "amber",
                                },
                                {
                                    label: "Forecast",
                                    value: teamForecast ? (
                                        amount(
                                            teamForecast.amount,
                                            teamForecast.currency,
                                        )
                                    ) : (
                                        <SegmentSkeleton />
                                    ),
                                },
                            ]}
                            note={`Paid is what the network actually received in the last ${period} days. Pending is the standing balance still owed, as of now. Forecast prices deals that are still open${teamForecast?.deal_count ? ` (from ${teamForecast.deal_count} open deal${teamForecast.deal_count === 1 ? "" : "s"}${teamForecast.truncated ? ", the network has more" : ""})` : ""} and hasn't been earned yet.`}
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
                        flush
                        title="Your network"
                        note="Every person below you, connected to who recruited them — drag to pan, scroll to zoom, click anyone to see their own numbers"
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
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
                            gap: 14,
                            alignItems: "start",
                        }}
                    >
                        <DashboardPanel
                            title="Commission trend"
                            note={`What the network was actually paid, month by month, over the last ${period} days`}
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
                            title="Network growth"
                            note="New agents each month (bars, left axis) against the running network size they add up to (line, right axis)"
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
                        flush
                        title="Recent commissions"
                        note="The network's latest commission activity, newest first — including reverted legs, so a clawback never goes unnoticed"
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

const tileGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
} as const;

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
    const { td } = useTd();

    if (!selection) {
        return (
            <span style={{ color: T.TEXT_MUTED }}>
                {td(
                    "Click anyone in the network above — including yourself at the top — to see their numbers.",
                )}
            </span>
        );
    }

    if (selection.kind === "you") {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                <div style={{ fontWeight: 700, color: T.NAVY }}>
                    {td("Your whole network")}
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
                                    {td("Active deals")}:{" "}
                                </span>
                                <strong>{networkSummary.active_deals}</strong>
                            </span>
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {td("Won")}:{" "}
                                </span>
                                <strong>{networkSummary.deals_won}</strong>
                            </span>
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {td("Leads in play")}:{" "}
                                </span>
                                <strong>{networkSummary.leads_active}</strong>
                            </span>
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {td("Paid")}:{" "}
                                </span>
                                <strong>
                                    {amount(networkSummary.paid, currency)}
                                </strong>
                            </span>
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {td("Pending")}:{" "}
                                </span>
                                <strong>
                                    {amount(networkSummary.pending, currency)}
                                </strong>
                            </span>
                            <span>
                                <span style={{ color: T.TEXT_HINT }}>
                                    {td("Forecast")}:{" "}
                                </span>
                                <strong>
                                    {networkForecast ? (
                                        amount(
                                            networkForecast.amount,
                                            currency,
                                        )
                                    ) : (
                                        <SegmentSkeleton />
                                    )}
                                </strong>
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                            {td(
                                "The same totals as the tile row above — everyone below you, none of your own activity.",
                            )}{" "}
                            {td("Won and paid cover the last")} {period}{" "}
                            {td("days")}.
                        </div>
                    </>
                ) : (
                    <span style={{ color: T.TEXT_MUTED }}>
                        {td("Loading your network's totals…")}
                    </span>
                )}
            </div>
        );
    }

    const { node } = selection;

    const rows: Array<[string, number | string, number | string]> = [
        [td("Active deals"), node.own.active_deals, node.network.active_deals],
        [td("Won"), node.own.deals_won, node.network.deals_won],
        [td("Leads in play"), node.own.leads_active, node.network.leads_active],
        [
            td("Paid"),
            amount(node.own.paid, currency),
            amount(node.network.paid, currency),
        ],
        [
            td("Pending"),
            amount(node.own.pending, currency),
            amount(node.network.pending, currency),
        ],
        [
            td("Forecast"),
            amount(node.own.forecast, currency),
            amount(node.network.forecast, currency),
        ],
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
            <div style={{ fontWeight: 700, color: T.NAVY }}>
                {node.name}
                {node.level && (
                    <span style={{ fontWeight: 400, color: T.TEXT_MUTED }}>
                        {" · "}
                        {node.level}
                    </span>
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
                                ({td("their whole branch")}: {branch})
                            </span>
                        )}
                    </span>
                ))}
            </div>
            <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                {td("Won and paid cover the last")} {period} {td("days")}.{" "}
                {td(
                    "Active deals, leads in play, pending and forecast are all as of right now.",
                )}
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
    const { td } = useTd();

    return (
        <DashboardPanel>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                {td("You have no agent record")}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                {td(
                    "A network is read from your own agent record. Ask an administrator to create one and set the agents who report to you.",
                )}
            </p>
        </DashboardPanel>
    );
}
