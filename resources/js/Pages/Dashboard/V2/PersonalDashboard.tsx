import { useCallback, useState } from "react";
import { Deferred, Head, router, usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import LogActionModal from "@/Components/CrmEvents/LogActionModal";
import CrmEventItem from "@/Components/CrmEvents/CrmEventItem";
import type { CrmEvent } from "@/Types/api/crm-event";
import {
    DEAL_TIMELINE_MODEL_TYPE,
    LEAD_TIMELINE_MODEL_TYPE,
} from "@/Pages/Deals/Redesign/hooks/useDealTimeline";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import useTaskStatus from "@/Hooks/useTaskStatus";
import type { Task } from "@/Types/api/tasks";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "./components/DashboardPanel";
import NextUp, { QueueItem } from "./components/NextUp";
import TodaySchedule from "./components/TodaySchedule";
import TaskActionModals from "./components/TaskActionModals";
import MeetingActionModals from "./components/MeetingActionModals";
import QueueRowActions from "./components/QueueRowActions";
import useDashboardTaskReschedule from "./hooks/useDashboardTaskReschedule";
import useDashboardMeetingStatus from "./hooks/useDashboardMeetingStatus";
import type { QueueTask, RelatedRecord, ScheduleEntry } from "./types";
import "@/Components/Redesign/redesign.css";
import "./dashboard-v2.css";

export interface PersonalDashboardProps {
    now: string;
    todaysTasks?: QueueTask[];
    followUpsDue?: ScheduleEntry[];
    recentActivity?: CrmEvent[];
    taskBoardColumns?: TaskboardColumn[];
}

/**
 * The landing page for a plain employee — someone with none of the
 * view_*_dashboard permissions, so no role-scoped V2 view applies.
 *
 * Deliberately not one of DashboardV2's four switcher views: there is nothing
 * to switch between here, just what one person owes today. Today's tasks and
 * due follow-ups reuse the same panels and actions (Complete, Reschedule, Log
 * activity, Mark held) the agent view already ships; recent activity is new,
 * reading straight off the shared CRM Event Engine.
 */
export default function PersonalDashboard({
    now,
    todaysTasks,
    followUpsDue,
    recentActivity,
    taskBoardColumns,
}: PersonalDashboardProps) {
    const { td } = useTd();
    const { auth } = usePage<PageProps>().props;
    const [openTask, setOpenTask] = useState<Task | null>(null);
    const [openMeeting, setOpenMeeting] = useState<ScheduleEntry | null>(null);
    const [logTarget, setLogTarget] = useState<RelatedRecord | null>(null);

    const reloadTasks = useCallback(
        () => router.reload({ only: ["todaysTasks", "taskBoardColumns"] }),
        [],
    );

    const { setStatus, isPending: isCompleting } = useTaskStatus(reloadTasks);
    const { reschedule, isPending: isRescheduling } =
        useDashboardTaskReschedule(reloadTasks);
    const { markHeld, isPending: isMarkingHeld } = useDashboardMeetingStatus(
        () => setOpenMeeting(null),
        ["followUpsDue"],
    );

    const items: QueueItem[] = (todaysTasks ?? []).map((task) => ({
        key: `task-${task.id}`,
        label: task.heading,
        reason: [
            task.related
                ? `${td(task.related.type === "lead" ? "Lead" : "Deal")}: ${task.related.name}`
                : td("No linked record"),
            task.days_overdue > 0
                ? td(`Task ${task.days_overdue} days overdue`)
                : td("Due today"),
        ].join(" · "),
        onOpen: () => setOpenTask(task),
        action: "Open task",
        severity: task.days_overdue > 0 ? "overdue" : "due",
        weight: task.days_overdue,
    }));

    const taskActions = useCallback(
        (item: QueueItem) => {
            const task = (todaysTasks ?? []).find(
                (row) => `task-${row.id}` === item.key,
            );
            if (!task) return null;

            return (
                <QueueRowActions
                    busy={isCompleting(task.id) || isRescheduling(task.id)}
                    done={task.board_column?.slug === "done"}
                    onComplete={() => setStatus(task.id, "done")}
                    onReschedule={(dueDate) => reschedule(task.id, dueDate)}
                    onLogActivity={
                        task.related
                            ? () => setLogTarget(task.related!)
                            : undefined
                    }
                />
            );
        },
        [todaysTasks, isCompleting, isRescheduling, setStatus, reschedule],
    );

    return (
        <DashboardLayout>
            <Head title={td("Dashboard")} />

            <PageLayout
                breadcrumbs={[{ name: td("Dashboard") }]}
                mainContentClassName=""
            >
                <div className="dashboard-v2">
                    <header
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 18,
                        }}
                    >
                        <h1
                            style={{
                                margin: 0,
                                fontSize: 19,
                                fontWeight: 700,
                                color: T.NAVY,
                            }}
                        >
                            {td("My day")}
                        </h1>

                        <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                            {dayjs(now).format("ddd D MMM · HH:mm")}
                        </span>
                    </header>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <DashboardPanel
                            flush
                            title="Today's tasks"
                            note="What's due today or already late."
                        >
                            <Deferred
                                data="todaysTasks"
                                fallback={
                                    <div style={{ padding: 18 }}>
                                        <PanelSkeleton rows={3} />
                                    </div>
                                }
                            >
                                {items.length ? (
                                    <NextUp
                                        items={items}
                                        renderActions={taskActions}
                                    />
                                ) : (
                                    <EmptyState text="Nothing due today." />
                                )}
                            </Deferred>
                        </DashboardPanel>

                        <DashboardPanel
                            title="Follow-ups due"
                            extra={
                                followUpsDue?.length ? (
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: T.TEXT_HINT,
                                        }}
                                    >
                                        {followUpsDue.length} {td("entries")}
                                    </span>
                                ) : undefined
                            }
                        >
                            <Deferred
                                data="followUpsDue"
                                fallback={<PanelSkeleton rows={3} />}
                            >
                                <TodaySchedule
                                    entries={followUpsDue ?? []}
                                    onOpen={setOpenMeeting}
                                    renderActions={(entry) =>
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
                            flush
                            title="Recent activity"
                            note="What you've logged or triggered lately."
                        >
                            <Deferred
                                data="recentActivity"
                                fallback={
                                    <div style={{ padding: 18 }}>
                                        <CardSkeleton height={80} />
                                    </div>
                                }
                            >
                                {recentActivity?.length ? (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 10,
                                            padding: 18,
                                        }}
                                    >
                                        {recentActivity.map((event) => (
                                            <CrmEventItem
                                                key={event.uuid}
                                                event={event}
                                                compact
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState text="Nothing logged recently." />
                                )}
                            </Deferred>
                        </DashboardPanel>
                    </div>

                    <TaskActionModals
                        task={openTask}
                        taskBoardColumns={taskBoardColumns ?? []}
                        onClose={() => setOpenTask(null)}
                        onPatched={setOpenTask}
                        onChanged={reloadTasks}
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
                            onSuccess={reloadTasks}
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
            </PageLayout>
        </DashboardLayout>
    );
}

function EmptyState({ text }: { text: string }) {
    const { td } = useTd();

    return (
        <div style={{ padding: "18px 18px 22px" }}>
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                {td(text)}
            </p>
        </div>
    );
}
