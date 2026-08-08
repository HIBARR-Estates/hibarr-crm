import { Alert, Col, Empty, Row, Select, Statistic } from "antd";
import { Deferred, router } from "@inertiajs/react";
import DashboardPanel, { PanelSkeleton } from "../components/DashboardPanel";
import StageFunnel, { StageFunnelDatum } from "../components/StageFunnel";
import LeaderboardTable, {
    LeaderboardRow,
} from "../components/LeaderboardTable";
import ActionQueue from "../components/ActionQueue";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface SlaBreaches {
    sla_hours: number;
    count: number;
    leads: Array<{
        id: number;
        client_name: string;
        waiting_hours: number;
    }>;
}

interface StageFunnelData {
    pipelines: Array<{ id: number; name: string; deal_count: number }>;
    pipeline_id: number | null;
    stages: StageFunnelDatum[];
}

export interface ManagerViewProps {
    stageFunnel?: StageFunnelData;
    leaderboard?: LeaderboardRow[];
    slaBreaches?: SlaBreaches;
    stalledDeals?: Array<{
        id: number;
        name: string;
        stage_name: string;
        days_in_stage: number;
        target_days: number;
    }>;
}

/**
 * Exception-based visibility: the panels are ordered so the things that need a
 * decision (SLA breaches, stalled deals) sit above the things that are merely
 * informative (funnel, leaderboard).
 */
export default function ManagerView({
    stageFunnel,
    leaderboard,
    slaBreaches,
    stalledDeals,
}: ManagerViewProps) {
    const { td } = useTd();

    return (
        <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
                <DashboardPanel title="Leads past first-contact SLA">
                    <Deferred data="slaBreaches" fallback={<PanelSkeleton rows={5} />}>
                        {slaBreaches ? (
                            <>
                                <Statistic
                                    value={slaBreaches.count}
                                    suffix={
                                        <span className="text-sm text-slate-400">
                                            {td("uncontacted past")}{" "}
                                            {slaBreaches.sla_hours}h
                                        </span>
                                    }
                                    valueStyle={{
                                        color:
                                            slaBreaches.count > 0
                                                ? "#dc2626"
                                                : "#16a34a",
                                    }}
                                />

                                <div className="mt-3">
                                    <ActionQueue
                                        groups={[
                                            {
                                                title: "Longest waiting",
                                                items: slaBreaches.leads.map(
                                                    (lead) => ({
                                                        key: `sla-${lead.id}`,
                                                        label: lead.client_name,
                                                        meta: `${lead.waiting_hours}h`,
                                                        href: route(
                                                            "lead-contact.show",
                                                            lead.id,
                                                        ),
                                                        severity: "overdue" as const,
                                                    }),
                                                ),
                                            },
                                        ]}
                                    />
                                </div>
                            </>
                        ) : (
                            <Empty description={td("No SLA data available")} />
                        )}
                    </Deferred>
                </DashboardPanel>
            </Col>

            <Col xs={24} lg={12}>
                <DashboardPanel
                    title="Deals past their stage target"
                    note="Only stages with a configured target duration are checked"
                >
                    <Deferred
                        data="stalledDeals"
                        fallback={<PanelSkeleton rows={5} />}
                    >
                        <ActionQueue
                            groups={[
                                {
                                    title: "Longest sitting",
                                    items: (stalledDeals ?? []).map((deal) => ({
                                        key: `stalled-${deal.id}`,
                                        label: `${deal.name} · ${td(deal.stage_name)}`,
                                        meta: `${deal.days_in_stage}d / ${deal.target_days}d`,
                                        href: route("deals.show", deal.id),
                                        severity: "stalled" as const,
                                    })),
                                },
                            ]}
                        />
                    </Deferred>
                </DashboardPanel>
            </Col>

            <Col xs={24} lg={10}>
                <DashboardPanel
                    title="Pipeline by stage"
                    extra={
                        stageFunnel && stageFunnel.pipelines.length > 1 ? (
                            <Select
                                size="small"
                                value={stageFunnel.pipeline_id ?? undefined}
                                style={{ minWidth: 160 }}
                                onChange={(id) =>
                                    router.visit(
                                        route("dashboard.v2", {
                                            view: "manager",
                                            pipeline: id,
                                        }),
                                        { preserveScroll: true },
                                    )
                                }
                                options={stageFunnel.pipelines.map((pipeline) => ({
                                    value: pipeline.id,
                                    label: `${td(pipeline.name)} (${pipeline.deal_count})`,
                                }))}
                            />
                        ) : undefined
                    }
                >
                    <Deferred data="stageFunnel" fallback={<PanelSkeleton rows={6} />}>
                        <StageFunnel data={stageFunnel?.stages ?? []} />
                    </Deferred>
                </DashboardPanel>
            </Col>

            <Col xs={24} lg={14}>
                <DashboardPanel
                    title="Team"
                    note="Direct reports only — deeper hierarchy needs the agent hierarchy backfilled"
                >
                    <Deferred data="leaderboard" fallback={<PanelSkeleton rows={5} />}>
                        {leaderboard?.length ? (
                            <LeaderboardTable rows={leaderboard} />
                        ) : (
                            <Alert
                                type="info"
                                showIcon
                                message={td("No agents report to you yet")}
                                description={td(
                                    "Team membership comes from the parent agent set on each agent record.",
                                )}
                            />
                        )}
                    </Deferred>
                </DashboardPanel>
            </Col>
        </Row>
    );
}
