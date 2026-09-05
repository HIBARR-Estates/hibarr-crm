import { Deferred } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "../components/DashboardPanel";
import StatTile from "../components/StatTile";
import TrendLine from "../components/TrendLine";
import TeamTree from "../components/TeamTree";
import { amount } from "../format";
import type { TeamGrowth, TeamSummary, TeamTree as TeamTreeData } from "../types";

export interface TeamViewProps {
    /** null for an account holding the permission but no lead_agent record. */
    teamSummary?: TeamSummary | null;
    teamGrowth?: TeamGrowth | null;
    teamTree?: TeamTreeData | null;
    /** Days the window covers, for copy. The picker owns the window itself. */
    period?: number;
    currentUserId?: number;
}

/**
 * Your network, and nothing of your own.
 *
 * Every figure covers the agents below you at any depth and excludes you. A
 * team lead reading this is asking how their people are doing, and folding
 * their own book into the totals is the fastest way to make that unreadable —
 * a strong personal closer can hide an idle network completely.
 *
 * Commission comes from mlm_commissions as MlmCommissionService wrote it. The
 * page does no commission arithmetic of its own, so it can never disagree with
 * an agent's own commission screen.
 */
export default function TeamView({
    teamSummary,
    teamGrowth,
    teamTree,
    period = 30,
    currentUserId,
}: TeamViewProps) {
    const { td } = useTd();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Deferred
                data="teamSummary"
                fallback={
                    <div style={tileGrid}>
                        {Array.from({ length: 5 }).map((_, index) => (
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
                            // Not windowed, and said so: a deal opened last year
                            // and still running is active today.
                            note={`Open right now · ${teamSummary.deals_won} won in the last ${period} days`}
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
                        title="Network growth"
                        note="Agents who joined each month, and the size that produced everything above"
                        footer={
                            teamGrowth ? (
                                <GrowthReading data={teamGrowth} />
                            ) : undefined
                        }
                    >
                        <Deferred
                            data="teamGrowth"
                            fallback={<PanelSkeleton rows={6} />}
                        >
                            {teamGrowth ? (
                                <TrendLine
                                    data={teamGrowth.points}
                                    xKey="label"
                                    height={240}
                                    series={[
                                        {
                                            dataKey: "total",
                                            label: "Network size",
                                            color: T.BLUE,
                                        },
                                        {
                                            dataKey: "joined",
                                            label: "Joined",
                                            color: T.GREEN,
                                        },
                                    ]}
                                />
                            ) : (
                                <span />
                            )}
                        </Deferred>
                    </DashboardPanel>

                    <DashboardPanel
                        flush
                        title="Your network"
                        note={`Everyone below you, by who recruited whom · won and paid cover the last ${period} days`}
                        extra={
                            teamTree?.your_level ? (
                                <span className="dr-pill dr-pill-blue">
                                    {td("Your level")}: {teamTree.your_level}
                                </span>
                            ) : undefined
                        }
                    >
                        <Deferred
                            data="teamTree"
                            fallback={
                                <div style={{ padding: 18 }}>
                                    <PanelSkeleton rows={6} />
                                </div>
                            }
                        >
                            {teamTree ? (
                                <TeamTree
                                    data={teamTree}
                                    currentUserId={currentUserId}
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
 * The growth curve in words. Derived, not written — the reading has to stay
 * true when the numbers move.
 */
function GrowthReading({ data }: { data: TeamGrowth }) {
    const { td } = useTd();

    if (!data.points.length) {
        return (
            <span style={{ color: T.TEXT_MUTED }}>
                {td("No months in this window to plot.")}
            </span>
        );
    }

    if (!data.joined) {
        return (
            <span style={{ color: T.TEXT_MUTED }}>
                {data.before
                    ? td("Nobody joined the network in this window.")
                    : td("No network yet — nobody has been recruited under you.")}
            </span>
        );
    }

    const best = data.points.reduce((a, b) => (a.joined >= b.joined ? a : b));

    return (
        <span style={{ color: T.TEXT }}>
            <strong>
                +{data.joined} {td("joined")}
            </strong>{" "}
            {td("in this window, taking the network to")}{" "}
            {data.points[data.points.length - 1].total}.{" "}
            {best.joined > 0 && (
                <>
                    {td("Best month was")} {best.label} {td("with")}{" "}
                    {best.joined}.
                </>
            )}
        </span>
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
