import { Col, Row, Statistic } from "antd";
import { Deferred } from "@inertiajs/react";
import ActionQueue, {
    ActionQueueGroup,
} from "../components/ActionQueue";
import DashboardPanel, { PanelSkeleton } from "../components/DashboardPanel";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface AgentStats {
    openDeals: number;
    wonThisMonth: number;
    closingThisWeek: number;
    openTasks: number;
}

interface ActionQueueData {
    overdueTasks: Array<{
        id: number;
        heading: string;
        days_overdue: number;
    }>;
    hotLeads: Array<{
        id: number;
        client_name: string;
        temperature: string;
        waiting_hours: number;
    }>;
    stalledDeals: Array<{
        id: number;
        name: string;
        stage_name: string;
        days_in_stage: number;
        target_days: number;
    }>;
}

export interface AgentViewProps {
    actionQueue?: ActionQueueData;
    agentStats?: AgentStats;
}

/**
 * A to-do list that happens to live inside a CRM — not a scaled-down manager
 * view. The queue leads; the personal numbers are a small strip beneath it.
 *
 * No quota widget: no targets exist anywhere in the system to measure against.
 */
export default function AgentView({ actionQueue, agentStats }: AgentViewProps) {
    const { td } = useTd();

    const groups: ActionQueueGroup[] = actionQueue
        ? [
              {
                  title: "Overdue tasks",
                  items: actionQueue.overdueTasks.map((task) => ({
                      key: `task-${task.id}`,
                      label: task.heading,
                      meta: `${task.days_overdue}d ${td("overdue")}`,
                      href: route("tasks.show", task.id),
                      severity: "overdue" as const,
                  })),
              },
              {
                  title: "Hot leads not yet contacted",
                  items: actionQueue.hotLeads.map((lead) => ({
                      key: `lead-${lead.id}`,
                      label: lead.client_name,
                      meta: `${lead.waiting_hours}h ${td("waiting")}`,
                      href: route("lead-contact.show", lead.id),
                      severity: "hot" as const,
                  })),
              },
              {
                  title: "Deals past their stage target",
                  items: actionQueue.stalledDeals.map((deal) => ({
                      key: `deal-${deal.id}`,
                      label: `${deal.name} · ${td(deal.stage_name)}`,
                      meta: `${deal.days_in_stage}d / ${deal.target_days}d`,
                      href: route("deals.show", deal.id),
                      severity: "stalled" as const,
                  })),
              },
          ]
        : [];

    return (
        <Row gutter={[16, 16]}>
            <Col xs={24} lg={15}>
                <DashboardPanel title="What needs you first">
                    <Deferred data="actionQueue" fallback={<PanelSkeleton rows={6} />}>
                        <ActionQueue groups={groups} />
                    </Deferred>
                </DashboardPanel>
            </Col>

            <Col xs={24} lg={9}>
                <DashboardPanel title="Your numbers">
                    <Deferred data="agentStats" fallback={<PanelSkeleton rows={3} />}>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Statistic
                                    title={td("Open deals")}
                                    value={agentStats?.openDeals ?? 0}
                                />
                            </Col>
                            <Col span={12}>
                                <Statistic
                                    title={td("Won this month")}
                                    value={agentStats?.wonThisMonth ?? 0}
                                />
                            </Col>
                            <Col span={12}>
                                <Statistic
                                    title={td("Closing this week")}
                                    value={agentStats?.closingThisWeek ?? 0}
                                />
                            </Col>
                            <Col span={12}>
                                <Statistic
                                    title={td("Open tasks")}
                                    value={agentStats?.openTasks ?? 0}
                                />
                            </Col>
                        </Row>
                    </Deferred>
                </DashboardPanel>
            </Col>
        </Row>
    );
}
