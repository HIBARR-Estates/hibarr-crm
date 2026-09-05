import { useCallback, useEffect, useMemo, useState } from "react";
import { Deferred, Head, router } from "@inertiajs/react";
import dayjs from "dayjs";
import { message } from "antd";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Badge, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import useTaskStatus from "@/Hooks/useTaskStatus";
import useTasksWorkspaceRedesignFlag from "@/Hooks/useTasksWorkspaceRedesignFlag";
import type { Task } from "@/Types/api/tasks";
import DashboardHeader from "./components/DashboardHeader";
import { VIEW_LABELS, type ViewKey } from "./viewConfig";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "./components/DashboardPanel";
import PersonalTaskModal from "./personal/PersonalTaskModal";
import PersonalTaskCreateModal from "./personal/PersonalTaskCreateModal";
import MeetingActionModals from "./components/MeetingActionModals";
import ScheduleMeetingDrawer from "@/Features/Meetings/ScheduleMeetingDrawer";
import useDashboardTaskReschedule from "./hooks/useDashboardTaskReschedule";
import useDashboardMeetingStatus from "./hooks/useDashboardMeetingStatus";
import type { QueueTask, ScheduleEntry } from "./types";
import SegmentedControl from "./personal/SegmentedControl";
import StatusLine from "./personal/StatusLine";
import StatStrip from "./personal/StatStrip";
import SignalQueue, { SignalQueueSkeleton } from "./personal/SignalQueue";
import SignalActions from "./personal/SignalActions";
import PipelineSplit from "./personal/PipelineSplit";
import AgendaTimeline from "./personal/AgendaTimeline";
import type { ActivityEvent } from "./personal/ActivityFeed";
import { severityOf } from "./personal/format";
import type {
    CommissionSummary,
    PersonalQueue,
    PersonalStats,
    PipelineRow,
    Severity,
} from "./personal/types";
import "@/Components/Redesign/redesign.css";
import "./dashboard-v2.css";

/**
 * Role views offered next to My work. Not all five — Company and Partner
 * answer questions this page isn't asking, and a wide switcher on a personal
 * landing page buries the ones a manager actually crosses to. The controller
 * narrows availableViews to these two before it ships them.
 */
type RoleView = Extract<ViewKey, "manager" | "team">;

export interface PersonalDashboardProps {
    now: string;
    userName: string;
    /** The stat strip's badges link into lists scoped to this id. */
    userId: number;
    /** DashboardMetricsService::PERSONAL_WINDOW_DAYS — how far ahead we look. */
    windowDays: number;
    /** Whichever of manager/team this account holds; empty for everyone else. */
    availableViews?: RoleView[];
    queue?: PersonalQueue;
    stats?: PersonalStats;
    commission?: CommissionSummary | null;
    agenda?: ScheduleEntry[];
    pipelines?: PipelineRow[];
    recentActivity?: ActivityEvent[];
    taskBoardColumns?: TaskboardColumn[];
    /** Feeds the agenda's empty-state "Schedule meeting" action. */
    userDeals?: Array<{ id: number; name: string }>;
    userLeads?: Array<{ id: number; name: string }>;
}

/**
 * The default V2 landing page: what one person owes right now.
 *
 * Holding a view_*_dashboard permission does not gate this page — it only adds
 * the role-scoped views as a second switcher.
 *
 * Everything below the status line is deferred and paints independently, so
 * the queue is readable before the pipeline panel has finished counting. Row
 * actions (Complete, Reschedule, Log activity) mutate through the existing
 * dashboard hooks and re-resolve only the keys that moved, never the page.
 */
export default function PersonalDashboard({
    now,
    userName,
    userId,
    windowDays,
    availableViews,
    queue,
    stats,
    commission,
    agenda,
    pipelines,
    recentActivity,
    taskBoardColumns,
    userDeals,
    userLeads,
}: PersonalDashboardProps) {
    const { td } = useTd();
    const useRedesignedTasks = useTasksWorkspaceRedesignFlag();
    const [openTask, setOpenTask] = useState<Task | null>(null);
    const [openMeeting, setOpenMeeting] = useState<ScheduleEntry | null>(null);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [createTaskOpen, setCreateTaskOpen] = useState(false);

    const tasksHref = route("tasks.index");
    const dealsHref = route("deals.index");

    const reloadQueue = useCallback(
        () =>
            router.reload({
                only: ["queue", "taskBoardColumns", "stats", "agenda"],
            }),
        [],
    );

    // Local overrides for tasks acted on from this page, applied on top of
    // `queue` the instant a click happens — Complete and Snooze never wait for
    // the request that's still in flight, and never trigger a reload once it
    // resolves either. A completed task is dropped from view for good; a
    // snoozed one gets its due date patched in place (and drops out of view
    // if that now falls past the window). Cleared whenever a genuinely new
    // `queue` lands — a task edit, for instance — since server truth has
    // superseded whatever was guessed locally by then.
    const [overrides, setOverrides] = useState<
        Record<number, { kind: "done" } | { kind: "snoozed"; dueDate: string }>
    >({});

    useEffect(() => {
        setOverrides({});
    }, [queue]);

    const clearOverride = useCallback((taskId: number) => {
        setOverrides((prev) => {
            if (!(taskId in prev)) return prev;
            const next = { ...prev };
            delete next[taskId];
            return next;
        });
    }, []);

    const { setStatus, isPending: isCompleting } = useTaskStatus(
        (taskId, slug) => {
            // "done" shows its own row-level spinner while the request is in
            // flight, then drops the task from view the moment it succeeds —
            // via `overrides`, a local patch, never a reload. The only other
            // way to reach this callback is the legacy (pre-redesign)
            // modal's status dropdown moving a task to some other column,
            // which isn't optimistically patched anywhere, so that path
            // still needs one.
            if (slug === "done") {
                setOverrides((prev) => ({
                    ...prev,
                    [taskId]: { kind: "done" },
                }));
            } else {
                reloadQueue();
            }
        },
        (taskId) => {
            clearOverride(taskId);
            message.error("Could not complete the task");
        },
    );
    const { reschedule, isPending: isSnoozing } = useDashboardTaskReschedule(
        () => {},
        (taskId) => clearOverride(taskId),
    );
    const { markHeld, isPending: isMarkingHeld } = useDashboardMeetingStatus(
        () => setOpenMeeting(null),
        ["agenda", "stats"],
    );

    const go = (next: Record<string, string>) =>
        router.visit(route("dashboard.v2", next), { preserveScroll: true });

    const visitRecord = useCallback(
        (record: { type: "lead" | "deal"; id: number }) =>
            router.visit(
                record.type === "lead"
                    ? route("lead-contact.show", record.id)
                    : route("deals.show", record.id),
            ),
        [],
    );

    const handleComplete = useCallback(
        (task: Task) => {
            // No optimistic override here — the row stays put, showing its
            // own loading state, until the request actually succeeds; see
            // useTaskStatus's onChanged above.
            setStatus(task.id, "done");
        },
        [setStatus],
    );

    const handleSnooze = useCallback(
        (task: Task, date: string) => {
            setOverrides((prev) => ({
                ...prev,
                [task.id]: { kind: "snoozed", dueDate: date },
            }));
            reschedule(task.id, date);
        },
        [reschedule],
    );

    const renderActions = useCallback(
        (task: QueueTask) => (
            <SignalActions
                severity={severityOf(task)}
                taskName={task.heading}
                completing={isCompleting(task.id)}
                snoozing={isSnoozing(task.id)}
                done={task.board_column?.slug === "done"}
                onComplete={() => handleComplete(task)}
                onSnooze={(date) => handleSnooze(task, date)}
            />
        ),
        [isCompleting, isSnoozing, handleComplete, handleSnooze],
    );

    /** Overdue → today's due bucket → the rest of the window, matching SignalQueue's own grouping. */
    const bucketKey = (severity: Severity): "overdue" | "today" | "later" =>
        severity === "now" ? "overdue" : severity === "soon" ? "today" : "later";

    // The queue with local overrides already applied, so the row list, the
    // section counts and the header pill all agree the instant Complete or
    // Snooze is clicked — none of them wait for, or ever get corrected by, a
    // follow-up request.
    const visibleQueue = useMemo(() => {
        if (!queue) return queue;
        if (Object.keys(overrides).length === 0) return queue;

        const today = dayjs(now).startOf("day");
        const windowEnd = dayjs(now).add(windowDays, "day").endOf("day");
        const delta = { overdue: 0, today: 0, later: 0 };

        const tasks = queue.tasks.reduce<QueueTask[]>((acc, task) => {
            const override = overrides[task.id];

            if (!override) {
                acc.push(task);
                return acc;
            }

            delta[bucketKey(severityOf(task))] -= 1;

            if (override.kind === "done") {
                return acc;
            }

            const due = dayjs(override.dueDate);

            // Snoozed past the window this queue covers — same as the row
            // never having been fetched for it.
            if (due.isAfter(windowEnd)) {
                return acc;
            }

            const patched: QueueTask = {
                ...task,
                due_date: override.dueDate,
                days_overdue: due.isBefore(today) ? today.diff(due, "day") : 0,
            };

            delta[bucketKey(severityOf(patched))] += 1;
            acc.push(patched);
            return acc;
        }, []);

        // A snoozed task's new position isn't where it sorted originally.
        tasks.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

        return {
            ...queue,
            tasks,
            counts: {
                overdue: Math.max(0, queue.counts.overdue + delta.overdue),
                today: Math.max(0, queue.counts.today + delta.today),
                later: Math.max(0, queue.counts.later + delta.later),
            },
        };
    }, [queue, overrides, now, windowDays]);

    const openNow = useMemo(
        () =>
            visibleQueue
                ? visibleQueue.counts.overdue +
                  visibleQueue.counts.today +
                  visibleQueue.counts.later
                : 0,
        [visibleQueue],
    );

    return (
        <DashboardLayout>
            <Head title={td("Dashboard")} />

            <PageLayout
                breadcrumbs={[{ name: td("Dashboard") }]}
                mainContentClassName=""
            >
                <div className="dashboard-v2">
                    <DashboardHeader
                        userName={userName}
                        now={now}
                        subtext={
                            <StatusLine
                                now={now}
                                queue={visibleQueue}
                                agenda={agenda}
                                pipelines={pipelines}
                            />
                        }
                        actions={
                            /* Built from availableViews rather than a fixed
                               list: the segments have to be the views this
                               account actually holds, or the switcher offers a
                               tab the server will refuse. */
                            !!availableViews?.length && (
                                <SegmentedControl
                                    label="Dashboard"
                                    active="personal"
                                    segments={[
                                        { value: "personal", label: VIEW_LABELS.personal },
                                        ...availableViews.map((view) => ({
                                            value: view,
                                            label: VIEW_LABELS[view],
                                        })),
                                    ]}
                                    onSelect={(view) =>
                                        view !== "personal" && go({ view })
                                    }
                                />
                            )
                        }
                    />

                    <div style={{ marginBottom: 20 }}>
                        <StatStrip
                            userId={userId}
                            windowDays={windowDays}
                            now={now}
                            stats={stats}
                            pipelines={pipelines}
                            commission={commission}
                        />
                    </div>

                    <div className="dv2-grid">
                        <div className="dv2-main">
                            <DashboardPanel
                                flush
                                title="Needs your attention"
                                extra={
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        {visibleQueue && (
                                            <Badge
                                                variant={
                                                    openNow ? "red" : "gray"
                                                }
                                            >
                                                {openNow} {td("open")}
                                            </Badge>
                                        )}
                                        {useRedesignedTasks ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setCreateTaskOpen(true)
                                                }
                                                style={{
                                                    fontSize: 12.5,
                                                    fontWeight: 600,
                                                    color: T.BLUE,
                                                    background: "none",
                                                    border: "none",
                                                    padding: 0,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {td("Add task")}
                                            </button>
                                        ) : (
                                            // Every section link below is
                                            // filtered — the plain list is
                                            // only offered here when there's
                                            // no create modal to reach for.
                                            <a
                                                href={tasksHref}
                                                style={{
                                                    fontSize: 12.5,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {td("All tasks")}
                                            </a>
                                        )}
                                    </div>
                                }
                            >
                                <Deferred
                                    data="queue"
                                    fallback={<SignalQueueSkeleton />}
                                >
                                    {visibleQueue ? (
                                        <SignalQueue
                                            queue={visibleQueue}
                                            userId={userId}
                                            windowDays={windowDays}
                                            onOpen={setOpenTask}
                                            onOpenRecord={(task) =>
                                                task.related &&
                                                visitRecord(task.related)
                                            }
                                            renderActions={renderActions}
                                            tasksHref={tasksHref}
                                        />
                                    ) : (
                                        <SignalQueueSkeleton />
                                    )}
                                </Deferred>
                            </DashboardPanel>

                            {/* "Activity on your records" is hidden for now —
                                not useful in its current state. Data plumbing
                                (recentActivity prop, ActivityFeed, the
                                deferred backend query) is left in place to
                                re-enable later; Pipeline takes the full row
                                until then instead of leaving an empty cell
                                beside it. */}
                            <DashboardPanel title="Open deals by pipeline">
                                <Deferred
                                    data="pipelines"
                                    fallback={<PanelSkeleton rows={4} />}
                                >
                                    <PipelineSplit
                                        pipelines={pipelines ?? []}
                                        dealsHref={dealsHref}
                                    />
                                </Deferred>
                            </DashboardPanel>
                        </div>

                        <div className="dv2-rail">
                            <Deferred
                                data="agenda"
                                fallback={<CardSkeleton height={220} />}
                            >
                                <AgendaTimeline
                                    meetings={agenda ?? []}
                                    now={now}
                                    onOpenMeeting={setOpenMeeting}
                                    onScheduleMeeting={() => setScheduleOpen(true)}
                                />
                            </Deferred>
                        </div>
                    </div>

                    <PersonalTaskModal
                        task={openTask}
                        taskBoardColumns={taskBoardColumns ?? []}
                        onClose={() => setOpenTask(null)}
                        onPatched={setOpenTask}
                        setStatus={setStatus}
                        isStatusPending={isCompleting}
                        onComplete={(task) => {
                            handleComplete(task);
                            setOpenTask(null);
                        }}
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

                    <ScheduleMeetingDrawer
                        open={scheduleOpen}
                        onClose={() => setScheduleOpen(false)}
                        userDeals={userDeals ?? []}
                        userLeads={userLeads ?? []}
                        onSuccess={() => {
                            setScheduleOpen(false);
                            router.reload({ only: ["agenda", "stats"] });
                        }}
                    />

                    {useRedesignedTasks && (
                        <PersonalTaskCreateModal
                            open={createTaskOpen}
                            taskBoardColumns={taskBoardColumns ?? []}
                            onClose={() => setCreateTaskOpen(false)}
                            onCreated={reloadQueue}
                        />
                    )}
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}
