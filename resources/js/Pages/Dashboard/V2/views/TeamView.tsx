import { Deferred } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "../components/DashboardPanel";
import StatTile from "../components/StatTile";
import {
    DownlineAgentTable,
    DownlineLevelTable,
} from "../components/DownlineTables";
import { money } from "../personal/format";
import type {
    DownlineAgents,
    DownlineLevels,
    DownlineSummary,
} from "../types";

export interface TeamViewProps {
    /** null for an account holding the permission but no lead_agent record. */
    downlineSummary?: DownlineSummary | null;
    downlineLevels?: DownlineLevels | null;
    downlineAgents?: DownlineAgents | null;
    period?: number;
    currentUserId?: number;
}

/**
 * The whole downline, not just the first level of it.
 *
 * The Team view (ManagerView) answers "how are my direct reports selling" over
 * one flat level. This answers the question a manager with sub-agents has
 * instead: how deep does my tree go, and what has each generation earned.
 *
 * Every figure here comes from mlm_commissions as MlmCommissionService wrote
 * it, or from that same service's preview() for the forecast — the page does no
 * commission arithmetic of its own, so it can never disagree with the agent's
 * own commission screen.
 */
export default function TeamView({
    downlineSummary,
    downlineLevels,
    downlineAgents,
    period = 30,
    currentUserId,
}: TeamViewProps) {
    const amount = (value: number, currency: string | null) =>
        currency ? money(value, currency) : Math.round(value).toLocaleString("en-US");

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Deferred
                data="downlineSummary"
                fallback={
                    <div style={tileGrid}>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <CardSkeleton key={index} height={116} />
                        ))}
                    </div>
                }
            >
                {downlineSummary ? (
                    <div style={tileGrid}>
                        <StatTile
                            label="Agents in downline"
                            value={downlineSummary.agents}
                            note={`${downlineSummary.direct_reports} direct, ${downlineSummary.generations} levels deep`}
                        />
                        <StatTile
                            label="Deals won"
                            tone="green"
                            value={downlineSummary.deals_won}
                            note={`Across the whole tree, last ${period} days`}
                        />
                        <StatTile
                            label="Commission paid"
                            tone="green"
                            value={amount(
                                downlineSummary.paid,
                                downlineSummary.currency,
                            )}
                            note={`Paid out in the last ${period} days`}
                        />
                        <StatTile
                            label="Commission pending"
                            value={amount(
                                downlineSummary.pending,
                                downlineSummary.currency,
                            )}
                            // Standing balance, not a windowed figure — said
                            // out loud so it isn't read against the picker.
                            note="Owed to the tree, all time"
                        />
                        <StatTile
                            label="Your level"
                            value={downlineSummary.root.level ?? "—"}
                            note={
                                downlineSummary.root.level
                                    ? "Sets the differential you earn on their deals"
                                    : "No level assigned yet"
                            }
                        />
                    </div>
                ) : (
                    <NoAgentRecord />
                )}
            </Deferred>

            {/* Both tables are dropped once we know there is no agent record —
                rendering their own empty states as well would tell the same
                person the same thing three times. */}
            {downlineSummary !== null && (
                <>
                    <DashboardPanel
                        flush
                        title="By level"
                        note={`Commission is credited to the agent who receives it, so the levels sum to the tree total · last ${period} days`}
                        footer={
                            downlineLevels ? (
                                <ForecastNote data={downlineLevels} />
                            ) : undefined
                        }
                    >
                        <Deferred
                            data="downlineLevels"
                            fallback={
                                <div style={{ padding: 18 }}>
                                    <PanelSkeleton rows={4} />
                                </div>
                            }
                        >
                            {downlineLevels ? (
                                <DownlineLevelTable data={downlineLevels} />
                            ) : (
                                <span />
                            )}
                        </Deferred>
                    </DashboardPanel>

                    <DashboardPanel
                        flush
                        title="Agents"
                        note={`Every agent under you, indented by level · last ${period} days`}
                    >
                        <Deferred
                            data="downlineAgents"
                            fallback={
                                <div style={{ padding: 18 }}>
                                    <PanelSkeleton rows={6} />
                                </div>
                            }
                        >
                            {downlineAgents ? (
                                <DownlineAgentTable
                                    data={downlineAgents}
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
 * What the forecast column actually covers.
 *
 * Pricing an open deal runs the full commission engine against it, so a large
 * tree is capped at the most recently touched deals. Saying so is the point:
 * an unlabelled partial total would read as the whole pipeline.
 */
function ForecastNote({ data }: { data: DownlineLevels }) {
    const { td } = useTd();

    if (!data.forecast_deals) {
        return (
            <span style={{ color: T.TEXT_MUTED }}>
                {td("No open deals in this downline to forecast from.")}
            </span>
        );
    }

    return (
        <span style={{ color: T.TEXT }}>
            {td("Forecast prices")} <strong>{data.forecast_deals}</strong>{" "}
            {td(
                "open deals through the commission engine — what they would pay if they close as they stand.",
            )}{" "}
            {data.forecast_truncated &&
                td(
                    "The tree has more open deals than that; the most recently updated ones are priced.",
                )}
        </span>
    );
}

/**
 * A manager can hold view_team_dashboard without holding a lead_agent record —
 * the permission is granted by role, the agent record is created per person.
 * Without one there is no root to walk from, and the view says so rather than
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
                    "A downline is read from your own agent record. Ask an administrator to create one and set the agents who report to you.",
                )}
            </p>
        </DashboardPanel>
    );
}
