import { Deferred, Head, router, usePage } from "@inertiajs/react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PageProps } from "@/Components/DashboardLayout";
import { AgentSecondRow, AgentWorkspaceLayout, useMinuteClock } from "@/Components/Redesign/agent";
import { useFilter } from "@/contexts/FilterContext";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import useTranslation from "@/Hooks/useTranslation";
import type { QueueTask } from "@/Types/personal-work";
import TaskScopePills from "./tasks/TaskScopePills";
import TasksHeader from "./tasks/TasksHeader";
import TasksTable, { TasksTableSkeleton } from "./tasks/TasksTable";
import { countViews, taskViews } from "./tasks/format";
import type { TaskChip, TaskScope, TasksPayload } from "./tasks/types";
import useTaskListWork from "./tasks/useTaskListWork";
import "./tasks/tasks.css";

// Opened on demand, so their code stays out of the first load.
const TasksFilterModal = lazy(() => import("./tasks/TasksFilterModal"));
const QueueTaskModal = lazy(() => import("@/Components/Redesign/modals/QueueTaskModal"));
const TaskSnoozeModal = lazy(() => import("@/Components/Redesign/modals/TaskSnoozeModal"));

interface TasksProps {
    pageTitle: string;
    userId: number;
    now: string;
    scope: TaskScope;
    canSeeTeam: boolean;
    limit: number;
    filters: Record<string, string | undefined>;
    tasks?: TasksPayload;
    taskBoardColumns?: TaskboardColumn[];
    categories?: Array<{ id: number; category_name: string }>;
    labels?: Array<{ id: number; label_name: string; label_color?: string }>;
    users?: Array<{ id: number; name: string }>;
    projects?: Array<{ id: number; project_name: string }>;
}

/** Filters that make up the Filters pill's count: a date range is one filter, not two. */
function filterCount(filters: Record<string, string | undefined>): number {
    const keys = Object.entries(filters)
        .filter(([key, value]) => key !== "scope" && value !== undefined && value !== "" && value !== null)
        .map(([key]) => key);
    const pairs: Array<[string, string]> = [
        ["due_start_date", "due_end_date"],
        ["created_start_date", "created_end_date"],
    ];
    return keys.length - pairs.filter(([a, b]) => keys.includes(a) && keys.includes(b)).length;
}

/**
 * Tasks: the agent workspace's list of open tasks (approved layout L7-17),
 * by due date with no date last. The rows arrive after the page. The chips
 * narrow them in the browser, and ticking or rescheduling a task changes the
 * screen first and then calls the existing endpoints; nothing reloads.
 */
export default function Tasks({
    pageTitle,
    userId,
    now,
    scope,
    canSeeTeam,
    limit,
    filters,
    tasks,
    taskBoardColumns,
    categories,
    labels,
    users,
    projects,
}: TasksProps) {
    const { t } = useTranslation();
    const { timezone } = useUserDateTime();
    const clock = useMinuteClock();
    // The server's clock for the first paint, the browser's once it ticks.
    const nowMs = Math.max(clock, Date.parse(now) || 0);
    const { url } = usePage<PageProps>();
    const { openDrawer } = useFilter();

    const [chip, setChip] = useState<TaskChip | null>(null);
    const [search, setSearch] = useState("");
    const [openTask, setOpenTask] = useState<QueueTask | null>(null);
    const [snoozeTask, setSnoozeTask] = useState<QueueTask | null>(null);

    // The pill answers at once; the list follows when the server's copy lands.
    const [shownScope, setShownScope] = useState<TaskScope>(scope);
    useEffect(() => setShownScope(scope), [scope]);

    const changeScope = useCallback(
        (next: TaskScope) => {
            if (next === shownScope) return;
            setShownScope(next);
            const data: Record<string, string> = { scope: next };
            for (const [key, value] of Object.entries(filters)) if (key !== "scope" && value) data[key] = value;
            router.get(route("agent.tasks"), data, { preserveState: true, preserveScroll: true, replace: true });
        },
        [filters, shownScope],
    );

    const work = useTaskListWork(tasks?.items);
    const views = useMemo(() => (work.rows ? taskViews(work.rows, nowMs, timezone) : undefined), [work.rows, nowMs, timezone]);
    const counts = useMemo(() => (views ? countViews(views) : undefined), [views]);
    const needle = search.trim().toLowerCase();
    const shown = useMemo(() => {
        if (!views) return views;
        if (!chip && !needle) return views;
        return views.filter((view) => {
            if (chip && view.chip !== chip) return false;
            if (!needle) return true;
            const { task } = view;
            const haystack = `${task.heading ?? ""} ${task.related?.name ?? ""} ${task.related?.person ?? ""}`.toLowerCase();
            return haystack.includes(needle);
        });
    }, [views, chip, needle]);

    // A chip that has just emptied (the last overdue task ticked) would leave a blank list.
    useEffect(() => {
        if (chip && counts && counts[chip] === 0) setChip(null);
    }, [chip, counts]);

    // Open tasks in this scope: the server's total, less what has been ticked since.
    const open = tasks && work.rows ? tasks.total - (tasks.items.length - work.rows.length) : undefined;
    const subtitle = open === undefined ? "" : open === 1 ? t("pages.agent_workspace.tasks.subtitle_one") : t("pages.agent_workspace.tasks.subtitle", { count: open });

    const [filtersMounted, setFiltersMounted] = useState(false);
    const mountedRef = useRef(false);
    const openFilters = useCallback(() => {
        if (mountedRef.current) {
            openDrawer();
            return;
        }
        mountedRef.current = true;
        setFiltersMounted(true);
    }, [openDrawer]);

    const handlers = useMemo(
        () => ({
            nowMs,
            timeZone: timezone,
            userId,
            onOpen: setOpenTask,
            onComplete: work.complete,
            onReschedule: setSnoozeTask,
            isCompleting: (taskId: number) => work.isStatusPending(taskId),
            isRescheduling: (taskId: number) => work.isReschedulePending(taskId),
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [nowMs, timezone, userId, work.complete, work.isStatusPending, work.isReschedulePending],
    );

    const truncated = tasks !== undefined && tasks.total > tasks.items.length;

    return (
        <>
            <Head title={pageTitle} />
            <AgentSecondRow>
                <TaskScopePills scope={shownScope} canSeeTeam={canSeeTeam} onScope={changeScope} filterCount={filterCount(filters)} onFilters={openFilters} />
            </AgentSecondRow>

            <div className="agent-tk">
                <TasksHeader subtitle={subtitle} counts={counts} chip={chip} onChip={setChip} searchText={search} onSearchText={setSearch} />

                <Deferred data="tasks" fallback={<TasksTableSkeleton />}>
                    {shown ? <TasksTable views={shown} handlers={handlers} /> : <TasksTableSkeleton />}
                </Deferred>

                {truncated ? (
                    <p className="agent-tk__truncated">{t("pages.agent_workspace.tasks.truncated", { limit: tasks.items.length, total: tasks.total })}</p>
                ) : null}
            </div>

            <Suspense fallback={null}>
                {filtersMounted ? (
                    <TasksFilterModal
                        categories={categories}
                        labels={labels}
                        users={users}
                        projects={projects}
                        total={open ?? 0}
                        appliedKey={`${url}|${JSON.stringify(filters)}`}
                    />
                ) : null}
                {openTask ? (
                    <QueueTaskModal
                        task={openTask}
                        taskBoardColumns={taskBoardColumns ?? []}
                        onClose={() => setOpenTask(null)}
                        onPatched={(task) => {
                            work.clear(task.id);
                            setOpenTask(task as QueueTask);
                        }}
                        setStatus={work.setStatus}
                        isStatusPending={work.isStatusPending}
                        onComplete={(task) => {
                            work.complete(task);
                            setOpenTask(null);
                        }}
                        onChanged={() => router.reload({ only: ["tasks"] })}
                    />
                ) : null}
                {snoozeTask ? (
                    <TaskSnoozeModal
                        open
                        taskName={snoozeTask.heading}
                        snoozing={false}
                        onClose={() => setSnoozeTask(null)}
                        onSelect={(date) => {
                            work.moveTo(snoozeTask, date);
                            setSnoozeTask(null);
                        }}
                    />
                ) : null}
            </Suspense>
        </>
    );
}

Tasks.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
