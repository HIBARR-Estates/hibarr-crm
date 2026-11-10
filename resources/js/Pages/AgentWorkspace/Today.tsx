import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Deferred, Head, router } from "@inertiajs/react";
import {
    AgentPillRow,
    AgentSecondRow,
    AgentWorkspaceLayout,
    agentPillPanelProps,
    dayKeyIn,
    useMinuteClock,
} from "@/Components/Redesign/agent";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import useMeetingAttendanceConfirmationFlag from "@/Hooks/useMeetingAttendanceConfirmationFlag";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { Task } from "@/Types/api/tasks";
import type { QueueTask, ScheduleEntry } from "@/Types/personal-work";
import TaskQueue, { TaskQueueSkeleton, type TaskHandlers } from "./today/TaskQueue";
import TodayHeader from "./today/TodayHeader";
import TodaySchedule, { TodayScheduleSkeleton } from "./today/TodaySchedule";
import type {
    CommissionSummary,
    PersonalQueue,
    PersonalStats,
    PipelineRow,
    TaskCategoryOption,
    TodaySchedule as TodayScheduleData,
} from "./today/types";
import useTodayWork, { MEETING_RELOAD_KEYS } from "./today/useTodayWork";
import Agenda from "./agenda/Agenda";
import AgendaHeader from "./agenda/AgendaHeader";
import { useAgendaOutcomes } from "./agenda/OutcomePanel";
import { AGENDA_VIEWS, isDayKey, shiftDate, type AgendaView } from "./agenda/range";
import useAgendaData from "./agenda/useAgendaData";
import "./today/today.css";
import "./agenda/agenda.css";

// Opened on demand, so their code (and the task and meeting modals behind
// them) stays out of the first load. Warmed once the page is idle.
const loadTaskModal = () => import("@/Components/Redesign/modals/QueueTaskModal");
const loadMeetingModals = () => import("@/Components/Redesign/meeting/MeetingActionModals");
const loadSnoozeModal = () => import("@/Components/Redesign/modals/TaskSnoozeModal");
const QueueTaskModal = lazy(loadTaskModal);
const MeetingActionModals = lazy(loadMeetingModals);
const TaskSnoozeModal = lazy(loadSnoozeModal);

interface TodayProps {
    pageTitle: string;
    userName: string;
    userId: number;
    /** Server time (ISO), for the first paint; the page keeps its own clock after that. */
    now: string;
    /** DashboardMetricsService::PERSONAL_WINDOW_DAYS: how far ahead the queue looks. */
    windowDays: number;
    queue?: PersonalQueue;
    taskBoardColumns?: TaskboardColumn[];
    taskCategories?: TaskCategoryOption[];
    stats?: PersonalStats;
    commission?: CommissionSummary | null;
    openDeals?: PipelineRow[];
    schedule?: TodayScheduleData;
}

type Panel = "work" | "schedule";
type Tab = "work" | "agenda";

function readUrl() {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    const view = params.get("view") as AgendaView | null;
    const date = params.get("date");
    return {
        tab: (params.get("tab") === "agenda" ? "agenda" : "work") as Tab,
        view: view && AGENDA_VIEWS.includes(view) ? view : ("list" as AgendaView),
        date: isDayKey(date) ? date : null,
    };
}

/** Keeps the pill, the agenda's view and its date in the URL without a visit. */
function writeUrl(changes: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(changes)) {
        if (value === null) url.searchParams.delete(key);
        else url.searchParams.set(key, value);
    }
    window.history.replaceState(window.history.state, "", url);
}

/** Hour of the day in `timeZone` (the browser's own when empty), like the rest of the app. */
function hourIn(nowMs: number, timeZone: string): number {
    const hour = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timeZone || undefined })
        .formatToParts(new Date(nowMs))
        .find((part) => part.type === "hour")?.value;
    return Number(hour ?? new Date(nowMs).getHours());
}

function greetingKey(hour: number): string {
    if (hour < 12) return "pages.agent_workspace.today.greeting_morning";
    if (hour < 18) return "pages.agent_workspace.today.greeting_afternoon";
    return "pages.agent_workspace.today.greeting_evening";
}

function panelFromUrl(): Panel {
    if (typeof window === "undefined") return "work";
    return new URLSearchParams(window.location.search).get("panel") === "schedule" ? "schedule" : "work";
}

/**
 * Today › My work, the agent workspace's home: the task queue on the left
 * and today's schedule on the right (approved layout T1). On a phone the two
 * become one column with a switch, work first.
 *
 * Runs on the personal dashboard's data and its existing endpoints. Every
 * action changes the screen first; nothing reloads the page.
 */
export default function Today({
    pageTitle,
    userName,
    userId,
    now,
    windowDays,
    queue,
    taskBoardColumns,
    stats,
    commission,
    openDeals,
    schedule,
}: TodayProps) {
    const { t, locale } = useTranslation();
    const { timezone } = useUserDateTime();
    const clock = useMinuteClock();
    // The server's clock for the first paint, the browser's once it ticks.
    const nowMs = Math.max(clock, Date.parse(now) || 0);
    const firstName = userName.split(" ")[0] ?? userName;

    const [panel, setPanel] = useState<Panel>(panelFromUrl);
    const today = dayKeyIn(nowMs, timezone);
    const [tab, setTab] = useState<Tab>(() => readUrl().tab);
    const [agendaView, setAgendaView] = useState<AgendaView>(() => readUrl().view);
    const [agendaDate, setAgendaDate] = useState<string | null>(() => readUrl().date);
    const date = agendaDate ?? today;
    const [openTask, setOpenTask] = useState<Task | null>(null);
    const [openMeeting, setOpenMeeting] = useState<ScheduleEntry | null>(null);
    const [snoozeTask, setSnoozeTask] = useState<QueueTask | null>(null);

    const agenda = useAgendaData(agendaView, date, tab === "agenda");
    const outcomesEnabled = useMeetingAttendanceConfirmationFlag();
    const outcomes = useAgendaOutcomes(outcomesEnabled && tab === "agenda", () => {
        void agenda.refresh();
        router.reload({ only: MEETING_RELOAD_KEYS });
    });
    const work = useTodayWork({
        queue,
        schedule,
        agenda: agenda.data,
        windowDays,
        timeZone: timezone,
        nowMs,
        onSaved: agenda.refresh,
    });

    const chooseTab = useCallback((next: Tab) => {
        setTab(next);
        writeUrl(next === "agenda" ? { tab: "agenda" } : { tab: null, view: null, date: null });
    }, []);

    const navigateAgenda = useCallback(
        (view: AgendaView, nextDate: string) => {
            setAgendaView(view);
            setAgendaDate(nextDate === today ? null : nextDate);
            writeUrl({ view: view === "list" ? null : view, date: nextDate === today ? null : nextDate });
        },
        [today],
    );

    useEffect(() => {
        const warm = () => {
            void loadTaskModal();
            void loadMeetingModals();
            void loadSnoozeModal();
        };
        if (typeof window.requestIdleCallback === "function") {
            const id = window.requestIdleCallback(warm, { timeout: 4000 });
            return () => window.cancelIdleCallback(id);
        }
        const id = setTimeout(warm, 2000);
        return () => clearTimeout(id);
    }, []);

    const choosePanel = useCallback((next: Panel) => {
        setPanel(next);
        const url = new URL(window.location.href);
        if (next === "work") url.searchParams.delete("panel");
        else url.searchParams.set("panel", next);
        window.history.replaceState(window.history.state, "", url);
    }, []);

    const dateLabel = useMemo(
        () =>
            new Date(nowMs).toLocaleDateString(locale || undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: timezone || undefined,
            }),
        // Re-format only when the day or language changes, not every minute.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [Math.floor(nowMs / 3_600_000), locale, timezone],
    );

    const meetingHandlers = {
        onOpenMeeting: setOpenMeeting,
        onMarkHeld: work.markHeld,
        isMarkingHeld: work.isHeldPending,
    };

    const handlers: TaskHandlers = {
        nowMs,
        timeZone: timezone,
        onOpen: setOpenTask,
        onComplete: work.completeTask,
        onReschedule: setSnoozeTask,
        isCompleting: work.isStatusPending,
        isRescheduling: work.isReschedulePending,
    };

    return (
        <>
            <Head title={pageTitle} />
            <AgentSecondRow>
                <AgentPillRow<Tab>
                    pills={[
                        { key: "work", label: t("pages.agent_workspace.today.work_tab") },
                        { key: "agenda", label: t("pages.agent_workspace.agenda.tab") },
                    ]}
                    active={tab}
                    onChange={chooseTab}
                    ariaLabel={t("pages.agent_workspace.today.title")}
                    idPrefix="agent-today"
                />
            </AgentSecondRow>
            {tab === "agenda" ? (
                <div className="agent-today agent-today--agenda" {...agentPillPanelProps("agent-today", "agenda")}>
                    <AgendaHeader
                        view={agendaView}
                        date={date}
                        today={today}
                        range={agenda.range}
                        data={work.agenda}
                        needOutcome={outcomesEnabled ? outcomes.items.length : undefined}
                        nowMs={nowMs}
                        timeZone={timezone}
                        onNavigate={navigateAgenda}
                        onStep={(direction) => navigateAgenda(agendaView, shiftDate(agendaView, date, direction))}
                    />
                    <Agenda
                        view={agendaView}
                        date={date}
                        today={today}
                        range={agenda.range}
                        data={work.agenda}
                        loading={agenda.loading}
                        updating={agenda.updating}
                        failed={agenda.failed}
                        onRetry={() => void agenda.retry()}
                        onSelectDay={(day) => navigateAgenda(agendaView, day)}
                        handlers={handlers}
                        meetingHandlers={meetingHandlers}
                        outcomes={outcomes}
                    />
                </div>
            ) : (
                <div className="agent-today" data-panel={panel} {...agentPillPanelProps("agent-today", "work")}>
                    <TodayHeader
                        greeting={t(greetingKey(hourIn(nowMs, timezone)), { name: firstName })}
                        dateLabel={dateLabel}
                        userId={userId}
                        nowMs={nowMs}
                        timeZone={timezone}
                        queue={work.queue}
                        schedule={work.schedule}
                        stats={stats}
                        commission={commission}
                        openDeals={openDeals}
                    />

                    <div className="agent-today__switch">
                        <Segmented<Panel>
                            value={panel}
                            onChange={choosePanel}
                            variant="raised"
                            fullWidth
                            ariaLabel={t("pages.agent_workspace.today.panels_label")}
                            options={[
                                {
                                    value: "work",
                                    label: t("pages.agent_workspace.today.work_tab"),
                                    count: work.queue ? work.queue.counts.overdue + work.queue.counts.today + work.queue.counts.later : undefined,
                                },
                                {
                                    value: "schedule",
                                    label: t("pages.agent_workspace.today.schedule_tab"),
                                    count: work.schedule ? work.schedule.meetings.length : undefined,
                                },
                            ]}
                        />
                    </div>

                    <div className="agent-today__grid">
                        <div className="agent-today__work" aria-label={t("pages.agent_workspace.today.work_tab")} role="region">
                            <Deferred data="queue" fallback={<TaskQueueSkeleton />}>
                                {work.queue ? <TaskQueue queue={work.queue} windowDays={windowDays} handlers={handlers} /> : <TaskQueueSkeleton />}
                            </Deferred>
                        </div>
                        <aside className="agent-today__schedule" aria-label={t("pages.agent_workspace.today.schedule_tab")}>
                            <Deferred data="schedule" fallback={<TodayScheduleSkeleton />}>
                                {work.schedule ? (
                                    <TodaySchedule
                                        schedule={work.schedule}
                                        dateLabel={dateLabel}
                                        handlers={handlers}
                                        {...meetingHandlers}
                                    />
                                ) : (
                                    <TodayScheduleSkeleton />
                                )}
                            </Deferred>
                        </aside>
                    </div>
                </div>
            )}

            <Suspense fallback={null}>
                {openTask ? (
                    <QueueTaskModal
                        task={openTask}
                        taskBoardColumns={taskBoardColumns ?? []}
                        onClose={() => setOpenTask(null)}
                        onPatched={(task) => {
                            work.clearTask(task.id);
                            setOpenTask(task);
                        }}
                        setStatus={work.setStatus}
                        isStatusPending={work.isStatusPending}
                        onComplete={(task) => {
                            work.completeTask(task);
                            setOpenTask(null);
                        }}
                        onChanged={() => {
                            work.reloadTasks();
                            void agenda.refresh();
                        }}
                    />
                ) : null}
                {openMeeting ? (
                    <MeetingActionModals
                        meeting={openMeeting}
                        onClose={() => setOpenMeeting(null)}
                        onMarkHeld={(id) => {
                            work.markHeld(id);
                            setOpenMeeting(null);
                        }}
                        markingHeld={work.isHeldPending(openMeeting.id)}
                        reloadKeys={MEETING_RELOAD_KEYS}
                        onRescheduled={() => void agenda.refresh()}
                    />
                ) : null}
                {snoozeTask ? (
                    <TaskSnoozeModal
                        open
                        taskName={snoozeTask.heading}
                        snoozing={false}
                        onClose={() => setSnoozeTask(null)}
                        onSelect={(date) => {
                            work.rescheduleTask(snoozeTask, date);
                            setSnoozeTask(null);
                        }}
                    />
                ) : null}
            </Suspense>
        </>
    );
}

Today.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
