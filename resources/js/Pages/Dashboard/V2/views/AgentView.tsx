import { useCallback, useState } from "react";
import { Deferred, router, usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import LogActionModal from "@/Components/CrmEvents/LogActionModal";
import {
    DEAL_TIMELINE_MODEL_TYPE,
    LEAD_TIMELINE_MODEL_TYPE,
} from "@/Pages/Deals/Redesign/hooks/useDealTimeline";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import useTaskStatus from "@/Hooks/useTaskStatus";
import type { Task } from "@/Types/api/tasks";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "../components/DashboardPanel";
import NextUp, { QueueItem } from "../components/NextUp";
import FullQueue from "../components/FullQueue";
import TodaySchedule from "../components/TodaySchedule";
import StageFunnel from "../components/StageFunnel";
import TaskActionModals from "../components/TaskActionModals";
import MeetingActionModals from "../components/MeetingActionModals";
import QueueRowActions from "../components/QueueRowActions";
import useDashboardTaskReschedule from "../hooks/useDashboardTaskReschedule";
import useDashboardMeetingStatus from "../hooks/useDashboardMeetingStatus";
import type {
    ActionQueueData,
    AgentPipeline,
    AgentWeek,
    QueueTask,
    RelatedRecord,
    ScheduleEntry,
} from "../types";

export interface AgentViewProps {
    actionQueue?: ActionQueueData;
    agentWeek?: AgentWeek;
    todaySchedule?: ScheduleEntry[];
    agentPipeline?: AgentPipeline;
    taskBoardColumns?: TaskboardColumn[];
}

/**
 * Three things, then everything else folded away.
 *
 * The queue is one ranked stream rather than three lookalike columns: an agent
 * opening this needs to know what to do next, not how their work partitions by
 * entity type. Everything below "Next up" is context for that decision.
 */
export default function AgentView({
    actionQueue,
    agentWeek,
    todaySchedule,
    agentPipeline,
    taskBoardColumns,
}: AgentViewProps) {
    const { td } = useTd();
    const { auth } = usePage<PageProps>().props;
    const [queueOpen, setQueueOpen] = useState(false);
    const [openTask, setOpenTask] = useState<Task | null>(null);
    const [openMeeting, setOpenMeeting] = useState<ScheduleEntry | null>(null);
    const [logTarget, setLogTarget] = useState<RelatedRecord | null>(null);

    // Inertia merges partial reloads, so the panel keeps its current rows on
    // screen while the fresh ones arrive — no skeleton flash, no local store.
    const reloadQueue = useCallback(
        () => router.reload({ only: ["actionQueue", "agentWeek"] }),
        [],
    );

    const openTaskById = useCallback(
        (task: QueueTask) => setOpenTask(task),
        [],
    );

    const { setStatus, isPending: isCompleting } = useTaskStatus(reloadQueue);
    const { reschedule, isPending: isRescheduling } =
        useDashboardTaskReschedule(reloadQueue);
    const { markHeld, isPending: isMarkingHeld } = useDashboardMeetingStatus(
        () => setOpenMeeting(null),
    );

    /** Complete + Reschedule + Log activity, for any row backed by a task. */
    const taskActions = useCallback(
        (task: QueueTask) => (
            <QueueRowActions
                busy={isCompleting(task.id) || isRescheduling(task.id)}
                done={task.board_column?.slug === "done"}
                onComplete={() => setStatus(task.id, "done")}
                onReschedule={(dueDate) => reschedule(task.id, dueDate)}
                // Activity is logged against the CRM record, not the task, so
                // rows with nothing linked have nothing to log against.
                onLogActivity={
                    task.related
                        ? () => setLogTarget(task.related!)
                        : undefined
                }
            />
        ),
        [isCompleting, isRescheduling, setStatus, reschedule],
    );

    const items = actionQueue ? rank(actionQueue, td, openTaskById) : [];
    const counts = actionQueue?.counts;
    const total = counts
        ? counts.overdueTasks + counts.hotLeads + counts.stalledDeals
        : 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Deferred data="agentWeek" fallback={<CardSkeleton height={58} />}>
                <WeekStrip week={agentWeek} />
            </Deferred>

            <DashboardPanel
                flush
                title="Next up"
                note="Three things worth doing before you open anything else."
                extra={
                    total > 3 ? (
                        <button
                            type="button"
                            className="dr-btn dr-btn-ghost"
                            style={{ color: T.BLUE, border: "none" }}
                            onClick={() => setQueueOpen((open) => !open)}
                        >
                            {queueOpen
                                ? td("Hide full queue")
                                : `${td("Open full queue")} · ${total}`}
                        </button>
                    ) : undefined
                }
            >
                <Deferred
                    data="actionQueue"
                    fallback={
                        <div style={{ padding: 18 }}>
                            <PanelSkeleton rows={3} />
                        </div>
                    }
                >
                    <NextUp
                        items={items.slice(0, 3)}
                        renderActions={(item) => {
                            const task = actionQueue?.overdueTasks.find(
                                (row) => `task-${row.id}` === item.key,
                            );

                            return task ? taskActions(task) : null;
                        }}
                    />
                </Deferred>
            </DashboardPanel>

            {actionQueue && total > 3 && (
                <>
                    <AlsoWaiting
                        queue={actionQueue}
                        open={queueOpen}
                        onToggle={() => setQueueOpen((open) => !open)}
                    />

                    {queueOpen && (
                        <DashboardPanel flush>
                            <FullQueue
                                queue={actionQueue}
                                onOpenTask={openTaskById}
                                renderTaskActions={taskActions}
                            />
                        </DashboardPanel>
                    )}
                </>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                    gap: 14,
                    alignItems: "start",
                }}
            >
                <DashboardPanel
                    title="Today"
                    extra={
                        todaySchedule?.length ? (
                            <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                                {todaySchedule.length} {td("entries")}
                            </span>
                        ) : undefined
                    }
                >
                    <Deferred
                        data="todaySchedule"
                        fallback={<PanelSkeleton rows={3} />}
                    >
                        <TodaySchedule
                            entries={todaySchedule ?? []}
                            onOpen={setOpenMeeting}
                            renderActions={(entry) =>
                                // Only for meetings that have already passed —
                                // marking a future one held is nonsense.
                                entry.at &&
                                new Date(entry.at) <= new Date() &&
                                entry.status !== "completed" ? (
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-ghost"
                                        disabled={isMarkingHeld(entry.id)}
                                        onClick={() => markHeld(entry.id)}
                                    >
                                        {td("Mark held")}
                                    </button>
                                ) : null
                            }
                        />
                    </Deferred>
                </DashboardPanel>

                <DashboardPanel
                    title="My pipeline"
                    extra={
                        agentPipeline?.value.length ? (
                            <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                                {agentPipeline.value
                                    .map(
                                        (row) =>
                                            `${row.currency} ${Math.round(row.total).toLocaleString()}`,
                                    )
                                    .join(" · ")}
                            </span>
                        ) : undefined
                    }
                >
                    <Deferred
                        data="agentPipeline"
                        fallback={<PanelSkeleton rows={5} />}
                    >
                        <>
                            <StageFunnel
                                emptyMessage="You have no open deals."
                                data={(agentPipeline?.funnel.stages ?? []).map(
                                    (stage) => ({
                                        key: stage.id,
                                        label: stage.name,
                                        count: stage.count,
                                        openMedianDays: stage.open_median_days,
                                        medianDays: stage.median_days,
                                        samples: stage.samples,
                                    }),
                                )}
                            />
                            {(agentPipeline?.value.length ?? 0) > 1 && (
                                <p
                                    style={{
                                        margin: "12px 0 0",
                                        paddingTop: 11,
                                        borderTop: `1px solid ${T.BORDER_SOFT}`,
                                        fontSize: 13,
                                        color: T.TEXT_MUTED,
                                        lineHeight: 1.5,
                                    }}
                                >
                                    {td(
                                        "Value stays split by currency — the stored exchange rates are not maintained, so a single total would be wrong.",
                                    )}
                                </p>
                            )}
                        </>
                    </Deferred>
                </DashboardPanel>
            </div>

            <TaskActionModals
                task={openTask}
                taskBoardColumns={taskBoardColumns ?? []}
                onClose={() => setOpenTask(null)}
                onPatched={setOpenTask}
                onChanged={reloadQueue}
            />

            <MeetingActionModals
                meeting={openMeeting}
                onClose={() => setOpenMeeting(null)}
                onMarkHeld={markHeld}
                markingHeld={
                    openMeeting ? isMarkingHeld(openMeeting.id) : false
                }
            />

            {logTarget && (
                <LogActionModal
                    open
                    onClose={() => setLogTarget(null)}
                    onSuccess={reloadQueue}
                    modelId={logTarget.id}
                    modelType={
                        logTarget.type === "lead"
                            ? LEAD_TIMELINE_MODEL_TYPE
                            : DEAL_TIMELINE_MODEL_TYPE
                    }
                    userId={auth?.user?.id}
                    nextStep={{
                        taskableType: logTarget.type,
                        taskableId: logTarget.id,
                        defaultAssigneeUserId: auth?.user?.id,
                    }}
                />
            )}
        </div>
    );
}

/** The week strip: what you did, not what you were assigned. */
function WeekStrip({ week }: { week?: AgentWeek }) {
    const { td } = useTd();

    if (!week) return null;

    const median = week.medianResponseMinutes;
    const stats: Array<[string | number, string]> = [
        [week.leadsContacted, "leads first contacted"],
        [week.meetings, "meetings"],
        [week.dealsCreated, "deals created"],
        [median === null ? "—" : formatDuration(median), "median first response"],
    ];

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 30,
                flexWrap: "wrap",
                padding: "15px 18px",
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
            }}
        >
            <div className="dv2-eyebrow">{td("Your week")}</div>

            {stats.map(([value, label]) => (
                <div key={label}>
                    <span
                        style={{ fontSize: 19, fontWeight: 700, color: T.NAVY }}
                    >
                        {value}
                    </span>{" "}
                    <span style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {td(label)}
                    </span>
                </div>
            ))}
        </div>
    );
}

/** Category chips for everything the top three didn't cover. */
function AlsoWaiting({
    queue,
    open,
    onToggle,
}: {
    queue: ActionQueueData;
    open: boolean;
    onToggle: () => void;
}) {
    const { td } = useTd();

    const chips: Array<{ label: string; variant: string }> = [];
    // Counts, not row lengths — the rows are capped server-side.
    const { counts } = queue;

    if (counts.overdueTasks) {
        chips.push({
            label: `${counts.overdueTasks} ${td("overdue tasks")}`,
            variant: "red",
        });
    }
    if (counts.hotLeads) {
        chips.push({
            label: `${counts.hotLeads} ${td("hot leads uncontacted")}`,
            variant: "amber",
        });
    }
    if (counts.stalledDeals) {
        chips.push({
            label: `${counts.stalledDeals} ${td("deals past stage target")}`,
            variant: "gray",
        });
    }
    if (counts.noNextStep) {
        chips.push({
            label: `${counts.noNextStep} ${td("records with no next step")}`,
            variant: "gray",
        });
    }

    if (!chips.length) return null;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                padding: "12px 18px",
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
            }}
        >
            <div className="dv2-eyebrow">{td("Also waiting")}</div>
            <span
                aria-hidden
                style={{ width: 1, height: 18, background: T.BORDER }}
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
                {chips.map((chip) => (
                    <span
                        key={chip.label}
                        className={`dr-pill dr-pill-${chip.variant}`}
                    >
                        {chip.label}
                    </span>
                ))}
            </div>

            <button
                type="button"
                className="dr-btn dr-btn-ghost"
                style={{ color: T.BLUE, border: "none", flex: "none" }}
                onClick={onToggle}
            >
                {open ? td("Hide") : td("Show all")}
            </button>
        </div>
    );
}

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 60 * 48) return `${Math.round(minutes / 60)}h`;

    return `${Math.round(minutes / 1440)}d`;
}

/**
 * One ranked stream out of the three queues.
 *
 * Already-late work outranks merely-hot work, and within a band the longest
 * wait wins. That ordering is the product decision the panel exists to express.
 */
function rank(
    queue: ActionQueueData,
    td: (value: string) => string,
    onOpenTask: (task: QueueTask) => void,
): QueueItem[] {
    // A task opens in place; a lead or deal has no dashboard modal, so those
    // still navigate to the record.
    const visit = (href: string) => () => router.visit(href);

    const tasks: QueueItem[] = queue.overdueTasks.map((task) => ({
        key: `task-${task.id}`,
        label: task.heading,
        reason: [
            task.related
                ? `${td(task.related.type === "lead" ? "Lead" : "Deal")}: ${task.related.name}`
                : td("No linked record"),
            td(`Task ${task.days_overdue} days overdue`),
        ].join(" · "),
        onOpen: () => onOpenTask(task),
        action: "Open task",
        severity: "overdue",
        // Band offsets keep the ordering categorical first, then by age within
        // the band: any overdue task outranks any waiting lead.
        weight: 1e6 + task.days_overdue,
    }));

    const leads: QueueItem[] = queue.hotLeads.map((lead) => ({
        key: `lead-${lead.id}`,
        label: lead.client_name,
        reason: [
            td(lead.temperature ?? "lead"),
            td(`Never contacted, waiting ${lead.waiting_hours}h`),
        ].join(" · "),
        onOpen: visit(route("lead-contact.show", lead.id)),
        action: "Open lead",
        severity: "hot",
        weight: 1e3 + lead.waiting_hours,
    }));

    const deals: QueueItem[] = queue.stalledDeals.map((deal) => ({
        key: `deal-${deal.id}`,
        label: deal.name,
        reason: [
            td(deal.stage_name),
            td(
                `${deal.days_in_stage} days in stage, target is ${deal.target_days}`,
            ),
        ].join(" · "),
        onOpen: visit(route("deals.show", deal.id)),
        action: "Open deal",
        severity: "stalled",
        weight: deal.days_in_stage - deal.target_days,
    }));

    return [...tasks, ...leads, ...deals].sort((a, b) => b.weight - a.weight);
}
