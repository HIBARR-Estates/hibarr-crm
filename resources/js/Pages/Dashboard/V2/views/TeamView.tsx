import { useState } from "react";
import { Deferred } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "../components/DashboardPanel";
import StatTile from "../components/StatTile";
import TeamNetworkGraph from "../components/TeamNetworkGraph";
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
    TeamTreeNode,
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
 * everyone below you is doing.
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
    const [selected, setSelected] = useState<TeamTreeNode | null>(null);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Deferred
                data="teamSummary"
                fallback={
                    <div style={tileGrid}>
                        {Array.from({ length: 7 }).map((_, index) => (
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
                            note={`${teamSummary.direct_reports} direct · ${teamSummary.generations} levels deep`}
                        />
                        <StatTile
                            label="Joined"
                            tone="green"
                            value={teamSummary.joined}
                            note={`New in the network, last ${period} days`}
                        />
                        <StatTile
                            label="Active deals"
                            value={teamSummary.active_deals}
                            // Not windowed, and said so: a deal opened last
                            // year and still running is active today.
                            note="Open right now, across the network"
                        />
                        <StatTile
                            label="Deals won"
                            tone="green"
                            value={teamSummary.deals_won}
                            note={`Closed in the last ${period} days`}
                        />
                        <StatTile
                            label="Leads in play"
                            value={teamSummary.leads_active}
                            note={
                                teamSummary.leads_untouched
                                    ? `${teamSummary.leads_untouched} more with no first contact yet`
                                    : "Contacted and not yet closed"
                            }
                        />
                        <StatTile
                            label="Network earned"
                            tone="green"
                            value={amount(
                                teamSummary.paid,
                                teamSummary.currency,
                            )}
                            note={`Paid in the last ${period} days · ${amount(teamSummary.pending, teamSummary.currency)} pending`}
                        />
                        <Deferred
                            data="teamForecast"
                            fallback={<CardSkeleton height={116} />}
                        >
                            {teamForecast ? (
                                <StatTile
                                    label="Commission forecast"
                                    value={amount(
                                        teamForecast.amount,
                                        teamForecast.currency,
                                    )}
                                    note={
                                        teamForecast.deal_count
                                            ? `Priced from ${teamForecast.deal_count} open deal${teamForecast.deal_count === 1 ? "" : "s"}${teamForecast.truncated ? " (network has more)" : ""}`
                                            : "No open deals to price yet"
                                    }
                                />
                            ) : (
                                <span />
                            )}
                        </Deferred>
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
                        note="Every person below you, by who recruited whom — drag to pan, scroll to zoom, click anyone for their numbers"
                        footer={
                            <NodeDetail
                                node={selected}
                                currency={teamTree?.currency ?? null}
                                period={period}
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
                                />
                            ) : (
                                <span />
                            )}
                        </Deferred>
                    </DashboardPanel>

                    <DashboardPanel
                        title="Commission trend"
                        note={`What the network was paid, month by month · last ${period} days`}
                    >
                        <Deferred
                            data="teamCommissionTrend"
                            fallback={<PanelSkeleton rows={6} />}
                        >
                            {teamCommissionTrend ? (
                                <CommissionTrendChart data={teamCommissionTrend} />
                            ) : (
                                <span />
                            )}
                        </Deferred>
                    </DashboardPanel>

                    <DashboardPanel
                        title="Network growth"
                        note="Agents who joined each month, against the running size that produced everything above"
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

                    <DashboardPanel
                        flush
                        title="Recent commissions"
                        note="Latest commission activity across the network"
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
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
} as const;

/**
 * The graph's footer: nobody's numbers until somebody is clicked, then that
 * person's own figure against their whole branch's — the same "own vs
 * network" reading the card itself only has room to hint at.
 */
function NodeDetail({
    node,
    currency,
    period,
}: {
    node: TeamTreeNode | null;
    currency: string | null;
    period: number;
}) {
    const { td } = useTd();

    if (!node) {
        return (
            <span style={{ color: T.TEXT_MUTED }}>
                {td("Click anyone in the network to see their own numbers against their branch's.")}
            </span>
        );
    }

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
                                ({td("branch")} {branch})
                            </span>
                        )}
                    </span>
                ))}
            </div>
            <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                {td("Won and paid cover the last")} {period} {td("days")}. {td("Active deals, leads, pending and forecast are as of now.")}
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
