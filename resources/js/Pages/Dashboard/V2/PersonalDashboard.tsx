import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Deferred, Head, router, usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import { message } from "antd";
import DashboardLayout, { type PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Badge, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import ProductTour, {
    type ProductTourHandle,
} from "@/Components/ProductTour/ProductTour";
import useTranslation from "@/Hooks/useTranslation";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import useTaskStatus from "@/Hooks/useTaskStatus";
import useTasksWorkspaceRedesignFlag from "@/Hooks/useTasksWorkspaceRedesignFlag";
import type { Task } from "@/Types/api/tasks";
import DashboardHeader from "./components/DashboardHeader";
import {
    buildSwitcher,
    localizeSwitcherSegments,
    type ViewKey,
} from "./viewConfig";
import DashboardPanel, {
    PanelSkeleton,
} from "./components/DashboardPanel";
import PersonalTaskModal from "./personal/PersonalTaskModal";
import PersonalTaskCreateModal from "./personal/PersonalTaskCreateModal";
import MeetingActionModals from "./components/MeetingActionModals";
import MeetingScheduleModal from "@/Components/Redesign/modals/MeetingScheduleModal";
import useDashboardTaskReschedule from "./hooks/useDashboardTaskReschedule";
import useDashboardMeetingStatus from "./hooks/useDashboardMeetingStatus";
import type { QueueTask, ScheduleEntry } from "./types";
import SegmentedControl from "./personal/SegmentedControl";
import StatusLine from "./personal/StatusLine";
import StatStrip from "./personal/StatStrip";
import SignalQueue, { SignalQueueSkeleton } from "./personal/SignalQueue";
import SignalActions from "./personal/SignalActions";
import PipelineSplit from "./personal/PipelineSplit";
import AgendaTimeline, { AgendaTimelineSkeleton } from "./personal/AgendaTimeline";
import type { ActivityEvent } from "./personal/ActivityFeed";
import { severityOf } from "./personal/format";
import type {
    CommissionSummary,
    PersonalQueue,
    PersonalStats,
    PipelineRow,
    Severity,
} from "./personal/types";
import {
    buildPersonalDashboardTourSteps,
    PERSONAL_DASHBOARD_TOUR_ID,
    PERSONAL_DASHBOARD_TOUR_LABELS,
} from "./config/personalDashboardTourSteps";
import "@/Components/Redesign/redesign.css";
import "./dashboard-v2.css";



export interface PersonalDashboardProps {
    now: string;
    userName: string;
    /** The stat strip's badges link into lists scoped to this id. */
    userId: number;
    /** DashboardMetricsService::PERSONAL_WINDOW_DAYS — how far ahead we look. */
    windowDays: number;
    /**
     * Every role view this account holds, permission- and flag-gated by the
     * controller. buildSwitcher decides which become tabs — this page does not
     * narrow the list itself, or its switcher would differ from the one on the
     * view you land on.
     */
    availableViews?: ViewKey[];
    queue?: PersonalQueue;
    stats?: PersonalStats;
    commission?: CommissionSummary | null;
    agenda?: ScheduleEntry[];
    /** Open-deal metrics for this user — not the shared nav `pipelines` list. */
    openDealsByPipeline?: PipelineRow[];
    recentActivity?: ActivityEvent[];
    taskBoardColumns?: TaskboardColumn[];
    /** Feeds the agenda's "Schedule meeting" / "Add meeting" action. */
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
    openDealsByPipeline,
    recentActivity,
    taskBoardColumns,
    userDeals,
    userLeads,
}: PersonalDashboardProps) {
    const { t } = useTranslation();
    const { props: pageProps } = usePage<PageProps>();
    const showProductTour =
        pageProps.featureFlags?.["crm.personal-dashboard"] === true;
    const tourRef = useRef<ProductTourHandle>(null);
    const personalDashboardTourSteps = useMemo(
        () => buildPersonalDashboardTourSteps(),
        [],
    );
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

    // Re-evaluate "next meeting" when the soonest agenda start passes, so an
    // in-progress meeting cannot keep the Next badge while a later one is
    // still queued.
    const [agendaClock, setAgendaClock] = useState(() => dayjs().toISOString());
    useEffect(() => {
        const MAX_TIMEOUT_MS = 60 * 60 * 1000;
        const nowMs = Date.now();
        const nextExpiry = (agenda ?? [])
            .map((entry) => (entry.at ? dayjs(entry.at).valueOf() : Number.NaN))
            .filter((time) => time > nowMs)
            .reduce<number | undefined>(
                (soonest, time) =>
                    soonest === undefined || time < soonest ? time : soonest,
                undefined,
            );
        if (nextExpiry === undefined) return;
        const timeout = setTimeout(
            () => setAgendaClock(dayjs().toISOString()),
            Math.min(nextExpiry - nowMs + 1000, MAX_TIMEOUT_MS),
        );
        return () => clearTimeout(timeout);
    }, [agenda, agendaClock]);

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
        () => { },
        (taskId) => clearOverride(taskId),
    );
    const { markHeld, isPending: isMarkingHeld } = useDashboardMeetingStatus(
        () => setOpenMeeting(null),
        ["agenda", "stats"],
    );

    const go = (next: Record<string, string>) =>
        router.visit(route("dashboard.v2", next), { preserveScroll: true });

    // This page is always the personal dashboard, so the flag that gates it is
    // on by definition — buildSwitcher's other caller is the one that has to
    // pass it through.
    const switcher = useMemo(
        () =>
            localizeSwitcherSegments(
                buildSwitcher(availableViews ?? [], true),
                t,
            ),
        [availableViews, t],
    );

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
            <Head title={t("pages.dashboard.personal.title")} />

            <PageLayout
                breadcrumbs={[
                    { name: t("pages.dashboard.personal.title") },
                ]}
                mainContentClassName=""
            >
                <div className="dashboard-v2">
                    {showProductTour && (
                        <ProductTour
                            ref={tourRef}
                            tourId={PERSONAL_DASHBOARD_TOUR_ID}
                            steps={personalDashboardTourSteps}
                            labels={PERSONAL_DASHBOARD_TOUR_LABELS}
                        />
                    )}

                    <DashboardHeader
                        userName={userName}
                        now={now}
                        subtext={
                            <div data-tour="dashboard-status-line">
                                <StatusLine
                                    now={now}
                                    clock={agendaClock}
                                    queue={visibleQueue}
                                    agenda={agenda}
                                    pipelines={openDealsByPipeline}
                                />
                            </div>
                        }
                        actions={
                            <>
                                {showProductTour && (
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-ghost"
                                        onClick={() =>
                                            tourRef.current?.restart()
                                        }
                                    >
                                        {t("pages.dashboard.tour.replay_menu_item")}
                                    </button>
                                )}
                                {switcher.length > 1 && (
                                    <SegmentedControl
                                        label={t(
                                            "pages.dashboard.views.switcher_aria",
                                        )}
                                        localize={false}
                                        active="personal"
                                        segments={switcher}
                                        onSelect={(view) =>
                                            view !== "personal" && go({ view })
                                        }
                                    />
                                )}
                            </>
                        }
                    />

                    <div
                        data-tour="dashboard-stat-strip"
                        style={{ marginBottom: 20 }}
                    >
                        <StatStrip
                            userId={userId}
                            windowDays={windowDays}
                            now={now}
                            stats={stats}
                            pipelines={openDealsByPipeline}
                            commission={commission}
                        />
                    </div>

                    <div className="dv2-grid">
                        <div className="dv2-main">
                            <DashboardPanel
                                flush
                                localize={false}
                                dataTour="dashboard-queue-panel"
                                title={t(
                                    "pages.dashboard.personal.panels.queue_title",
                                )}
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
                                                {openNow}{" "}
                                                {t(
                                                    "pages.dashboard.personal.actions.open",
                                                )}
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
                                                {t(
                                                    "pages.dashboard.personal.actions.add_task",
                                                )}
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
                                                {t(
                                                    "pages.dashboard.personal.actions.all_tasks",
                                                )}
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
                        </div>

                        <div className="dv2-rail">
                            <div data-tour="dashboard-agenda">
                                <Deferred
                                    data="agenda"
                                    fallback={<AgendaTimelineSkeleton />}
                                >
                                    <AgendaTimeline
                                        meetings={agenda ?? []}
                                        now={now}
                                        clock={agendaClock}
                                        onOpenMeeting={setOpenMeeting}
                                        onScheduleMeeting={() =>
                                            setScheduleOpen(true)
                                        }
                                    />
                                </Deferred>
                            </div>

                            <DashboardPanel
                                localize={false}
                                dataTour="dashboard-pipeline-panel"
                                title={t(
                                    "pages.dashboard.personal.panels.pipeline_title",
                                )}
                            >
                                <Deferred
                                    data="openDealsByPipeline"
                                    fallback={<PanelSkeleton rows={4} />}
                                >
                                    <PipelineSplit
                                        pipelines={openDealsByPipeline ?? []}
                                        dealsHref={dealsHref}
                                    />
                                </Deferred>
                            </DashboardPanel>
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
                        reloadKeys={["agenda", "stats"]}
                    />

                    <MeetingScheduleModal
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
