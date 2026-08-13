import { Deferred } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "../components/DashboardPanel";
import StatTile from "../components/StatTile";
import LifecycleFunnel from "../components/LifecycleFunnel";
import ResponseDistribution from "../components/ResponseDistribution";
import SourceBreakdown from "../components/SourceBreakdown";
import LeaderboardTable from "../components/LeaderboardTable";
import PartnerFlagQueue from "../components/PartnerFlagQueue";
import type {
    LifecycleFunnel as FunnelData,
    PartnerFlagRow,
    ResponseDistribution as ResponseData,
    SourceQualityRow,
    TeamAgents,
    TeamKpis,
} from "../types";

export interface ManagerViewProps {
    teamKpis?: TeamKpis;
    lifecycleFunnel?: FunnelData;
    responseDistribution?: ResponseData;
    sourceQuality?: SourceQualityRow[];
    teamAgents?: TeamAgents;
    openPartnerFlags?: PartnerFlagRow[];
    period?: number;
    currentUserId?: number;
}

/**
 * Statistics a manager can act on.
 *
 * The old exception panels (SLA breach list, stalled-deal list) are gone as
 * separate cards — they now live as the per-agent "needs attention" column,
 * which is where the decision actually gets made. A manager doesn't reassign a
 * lead, they reassign an agent's load.
 */
export default function ManagerView({
    teamKpis,
    lifecycleFunnel,
    responseDistribution,
    sourceQuality,
    teamAgents,
    openPartnerFlags,
    period = 30,
    currentUserId,
}: ManagerViewProps) {
    const { td } = useTd();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Deferred
                data="teamKpis"
                fallback={
                    <div style={tileGrid}>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <CardSkeleton key={index} height={116} />
                        ))}
                    </div>
                }
            >
                <div style={tileGrid}>
                    <StatTile
                        label="New leads"
                        value={teamKpis?.newLeads.value ?? null}
                        previous={teamKpis?.newLeads.previous}
                        spark={teamKpis?.newLeads.spark}
                        // English source string — StatTile translates it once.
                        note={`${teamKpis?.newLeads.previous ?? 0} in the previous window`}
                    />
                    <StatTile
                        label="Contacted within SLA"
                        unit="%"
                        value={teamKpis?.contactedInSla.value ?? null}
                        previous={teamKpis?.contactedInSla.previous}
                        spark={teamKpis?.contactedInSla.spark}
                        note={teamKpis?.contactedInSla.note}
                    />
                    <StatTile
                        label="Meetings"
                        value={teamKpis?.meetings.value ?? null}
                        previous={teamKpis?.meetings.previous}
                        spark={teamKpis?.meetings.spark}
                        note={teamKpis?.meetings.note}
                    />
                    <StatTile
                        label="Deals created"
                        value={teamKpis?.dealsCreated.value ?? null}
                        previous={teamKpis?.dealsCreated.previous}
                        spark={teamKpis?.dealsCreated.spark}
                    />
                    <StatTile
                        label="Deals won"
                        tone="green"
                        value={teamKpis?.dealsWon.value ?? null}
                        previous={teamKpis?.dealsWon.previous}
                        spark={teamKpis?.dealsWon.spark}
                    />
                </div>
            </Deferred>

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
                    title="Funnel and stage conversion"
                    note={`Leads created in the last ${lifecycleFunnel?.days ?? 90} days, followed forward`}
                    footer={
                        lifecycleFunnel ? (
                            <FunnelReading data={lifecycleFunnel} />
                        ) : undefined
                    }
                >
                    <Deferred
                        data="lifecycleFunnel"
                        fallback={<PanelSkeleton rows={6} />}
                    >
                        {lifecycleFunnel ? (
                            <LifecycleFunnel data={lifecycleFunnel} />
                        ) : (
                            <span />
                        )}
                    </Deferred>
                </DashboardPanel>

                <div
                    style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                    <DashboardPanel
                        title="First response time"
                        note={`Leads created in the last ${period} days`}
                    >
                        <Deferred
                            data="responseDistribution"
                            fallback={<PanelSkeleton rows={5} />}
                        >
                            {responseDistribution ? (
                                <ResponseDistribution
                                    data={responseDistribution}
                                />
                            ) : (
                                <span />
                            )}
                        </Deferred>
                    </DashboardPanel>

                    <DashboardPanel
                        title="Source quality"
                        note="Volume against what it converts to — no cost data reaches the CRM"
                    >
                        <Deferred
                            data="sourceQuality"
                            fallback={<PanelSkeleton rows={4} />}
                        >
                            <SourceBreakdown
                                showWon
                                rows={sourceQuality ?? []}
                            />
                        </Deferred>
                    </DashboardPanel>
                </div>
            </div>

            {/* Only rendered once a flag exists — an always-present empty
                panel trains people to stop looking at it. */}
            {!!openPartnerFlags?.length && (
                <DashboardPanel
                    title="Partner flags"
                    note="Partners asking for a look at a referral they introduced"
                >
                    <PartnerFlagQueue rows={openPartnerFlags} />
                </DashboardPanel>
            )}

            <DashboardPanel
                flush
                title="Agents"
                note={`Last ${period} days · the marker on each bar is the team median`}
            >
                <Deferred
                    data="teamAgents"
                    fallback={
                        <div style={{ padding: 18 }}>
                            <PanelSkeleton rows={5} />
                        </div>
                    }
                >
                    {teamAgents ? (
                        <LeaderboardTable
                            data={teamAgents}
                            currentUserId={currentUserId}
                        />
                    ) : (
                        <span />
                    )}
                </Deferred>
            </DashboardPanel>
        </div>
    );
}

const tileGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
} as const;

/**
 * Names the biggest leak in words. Derived, not written by hand — the reading
 * has to stay true when the numbers move.
 */
function FunnelReading({ data }: { data: FunnelData }) {
    const { td } = useTd();

    const measured = data.steps.filter((step) => step.to_next !== null);

    if (!measured.length || data.steps[0].count === 0) {
        return (
            <span style={{ color: T.TEXT_MUTED }}>
                {td("Not enough leads in this window to read a funnel.")}
            </span>
        );
    }

    const worst = measured.reduce((a, b) =>
        (a.to_next ?? 100) <= (b.to_next ?? 100) ? a : b,
    );
    const next = data.steps[data.steps.indexOf(worst) + 1];

    // The steps are not strictly nested — a deal can be created without any
    // meeting logged — so this is stated rather than smoothed over.
    const unnested = data.steps.some(
        (step, index) => index > 0 && step.count > data.steps[index - 1].count,
    );

    return (
        <span style={{ color: T.TEXT }}>
            <strong>
                {td(worst.label)} → {td(next?.label ?? "")}
            </strong>{" "}
            {td("is the narrowest step at")} {worst.to_next}%
            {worst.median_days !== null && (
                <>
                    , {td("taking a median of")} {worst.median_days}
                    {td("d")}
                </>
            )}
            .{" "}
            {unnested &&
                td(
                    "Steps are not strictly nested — a deal can be created without a meeting ever being logged.",
                )}
        </span>
    );
}
