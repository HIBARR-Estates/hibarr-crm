import { useEffect, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import useTaskStatus, { applyTaskStatus } from "@/Hooks/useTaskStatus";
import useDashboardTaskUpdate from "@/Pages/Dashboard/V2/hooks/useDashboardTaskUpdate";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { Task } from "@/Types/api/tasks";
import type { DealFollowup } from "@/Types/api/deal-followup";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import TaskDetailModal from "@/Components/Redesign/modals/TaskDetailModal";
import MeetingDetailModal from "@/Components/Redesign/modals/MeetingDetailModal";
import RescheduleMeetingModal from "@/Components/Redesign/modals/RescheduleMeetingModal";
import { buildRescheduleFormFromFollowup } from "@/Components/Redesign/meeting/meetingFormUtils";
import useLeadIndexMeetingReschedule from "./useLeadIndexMeetingReschedule";

export interface NextActionRef {
    type: "task" | "meeting";
    id: number;
}

interface NextActionDetailFlowProps {
    action: NextActionRef | null;
    onClose: () => void;
    taskBoardColumns: TaskboardColumn[];
}

/**
 * Click-through from the Leads index Next Action column: fetches the one
 * task or meeting on demand (the list itself only ever carries the trimmed
 * {type, id, title, due_at} — see LeadService::attachNextActions) and opens
 * the same detail modal the record's own workspace page uses.
 */
export default function NextActionDetailFlow({
    action,
    onClose,
    taskBoardColumns,
}: NextActionDetailFlowProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props } = usePage();
    const userId = props.auth?.user?.id;

    // retry: false — a "fetch this one record" request that fails once
    // (permissions, a bad id) won't succeed by retrying identically, and
    // TanStack's default 3-retry exponential backoff (~1s + 2s + 4s) was
    // exactly the multi-second silent wait before the modal ever appeared.
    const {
        data: taskData,
        isLoading: taskLoading,
        isError: taskLoadError,
    } = useApiQuery<{ task: Task }>({
        path: action?.type === "task" ? route("tasks.data", action.id) : "",
        options: { enabled: action?.type === "task", retry: false },
    });
    const {
        data: meetingData,
        isLoading: meetingLoading,
        isError: meetingLoadError,
    } = useApiQuery<{ followUp: DealFollowup }>({
        path:
            action?.type === "meeting"
                ? route("deals.follow_up_data", action.id)
                : "",
        options: { enabled: action?.type === "meeting", retry: false },
    });

    // Local copies so an edit/status-change reflects immediately without
    // waiting for the query to refetch; reset whenever a different record
    // is opened.
    const [task, setTask] = useState<Task | null>(null);
    const [meeting, setMeeting] = useState<DealFollowup | null>(null);

    useEffect(() => {
        setTask(action?.type === "task" ? (taskData?.task ?? null) : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [action?.type === "task" ? action.id : null, taskData]);

    useEffect(() => {
        setMeeting(
            action?.type === "meeting" ? (meetingData?.followUp ?? null) : null,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [action?.type === "meeting" ? action.id : null, meetingData]);

    // router.get on the current URL/filters rather than router.reload()'s
    // window.location.href shorthand — matches Index.tsx's own pagination
    // reload exactly, so there's no ambiguity about what gets re-requested.
    const reloadLeads = () =>
        router.get(
            route("lead-contact.index"),
            mergeQueryParams({}),
            { only: ["leads"], preserveState: true, preserveScroll: true },
        );

    const { setStatus, isPending } = useTaskStatus((_taskId, slug) => {
        setTask((current) => (current ? applyTaskStatus(current, slug) : current));
        reloadLeads();
    });

    const { updateTask, isUpdating, errors: taskErrors, clearErrors: clearTaskErrors } =
        useDashboardTaskUpdate(task ?? ({ id: 0 } as Task), (updated) => {
            setTask(updated);
            reloadLeads();
        });

    // Mirrors TaskActionModals: the queue only ever shows tasks visible to
    // this user, so anyone opening one may edit it.
    const canWriteTask = Boolean(
        task &&
            (task.added_by === userId ||
                task.users?.some((user) => user.id === userId)),
    );

    const {
        rescheduleMeeting,
        isRescheduling,
        errors: meetingErrors,
        clearErrors: clearMeetingErrors,
    } = useLeadIndexMeetingReschedule(meeting?.id ?? null);

    const rescheduleInitialForm = useMemo(
        () => (meeting ? buildRescheduleFormFromFollowup(meeting) : null),
        [meeting],
    );

    const handleClose = () => {
        clearTaskErrors();
        clearMeetingErrors();
        onClose();
    };

    // The real detail modals only open once `task`/`meeting` is populated
    // (TaskDetailModal/MeetingDetailModal both key `open` off the record
    // being non-null) — without this, the click sat there doing nothing
    // visible for as long as the fetch took.
    const isLoadingDetail =
        (action?.type === "task" && taskLoading) ||
        (action?.type === "meeting" && meetingLoading);
    const detailLoadErrored =
        (action?.type === "task" && taskLoadError) ||
        (action?.type === "meeting" && meetingLoadError);

    return (
        <>
            <Modal
                open={Boolean(action) && (isLoadingDetail || detailLoadErrored)}
                onClose={handleClose}
                title={
                    action?.type === "meeting"
                        ? td("Meeting", { source: "en" })
                        : td("Task", { source: "en" })
                }
            >
                {detailLoadErrored ? (
                    <p style={{ fontSize: 14, color: T.RED, margin: 0 }}>
                        {td("Couldn't load this — try again.", { source: "en" })}
                    </p>
                ) : (
                    <div className="flex items-center justify-center py-6">
                        <span
                            className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
                            style={{ width: 22, height: 22, color: T.BLUE }}
                        />
                    </div>
                )}
            </Modal>

            <TaskDetailModal
                task={action?.type === "task" ? task : null}
                taskBoardColumns={taskBoardColumns}
                onClose={handleClose}
                canWrite={canWriteTask}
                isStatusPending={task ? isPending(task.id) : false}
                onStatusChange={(slug) => {
                    if (task) setStatus(task.id, slug);
                }}
                isUpdating={isUpdating}
                errors={taskErrors}
                clearErrors={clearTaskErrors}
                onUpdate={(input, onSuccess) => updateTask(input, onSuccess)}
                labels={{
                    viewTitle: t("pages.deals.workspace.tasks.view_title"),
                    editTitle: t("pages.deals.workspace.tasks.edit_task"),
                    cancel: t("pages.deals.common.cancel"),
                    save: t("pages.deals.common.save_changes"),
                    delete: t("pages.deals.workspace.tasks.delete_task"),
                    edit: t("pages.deals.workspace.tasks.edit_task"),
                    titleField: t("pages.deals.workspace.tasks.title_field"),
                    description: t("pages.deals.common.description"),
                    descriptionPlaceholder: t(
                        "pages.deals.common.optional_details_placeholder",
                    ),
                    startDate: t("pages.deals.common.start_date"),
                    dueDate: t("pages.deals.common.due_date"),
                    dueTime: t("pages.deals.common.due_time"),
                    priority: t("pages.deals.common.priority"),
                    priorityHigh: t("pages.deals.common.priority_high"),
                    priorityMedium: t("pages.deals.common.priority_medium"),
                    priorityLow: t("pages.deals.common.priority_low"),
                    priorityHighest: t("pages.deals.common.priority_highest"),
                    priorityUrgent: t("pages.deals.common.priority_urgent"),
                    assignees: t("pages.deals.common.assignees"),
                    overdue: t("pages.deals.workspace.tasks.overdue"),
                    noDescription: t("pages.deals.common.no_description"),
                    unassigned: t("pages.deals.common.unassigned"),
                    dateRangeError: t(
                        "pages.deals.workspace.tasks.date_range_error",
                    ),
                }}
            />

            <MeetingDetailModal
                meeting={action?.type === "meeting" ? meeting : null}
                canEdit={false}
                canDelete={false}
                canReschedule
                onClose={handleClose}
                isUpdating={isRescheduling}
                // Cancel is gated behind canEdit and so never renders here;
                // editing a lead-only meeting needs the deal it belongs to
                // (deals.follow_up_update 500s without one), so both stay on
                // the lead's own page — closing is the honest no-op.
                onCancelMeeting={handleClose}
                renderNestedModals={({ rescheduleOpen, setRescheduleOpen }) =>
                    meeting ? (
                        <RescheduleMeetingModal
                            open={rescheduleOpen}
                            onClose={() => setRescheduleOpen(false)}
                            saving={isRescheduling}
                            errors={meetingErrors}
                            initialForm={rescheduleInitialForm}
                            onSubmit={(payload) =>
                                rescheduleMeeting(payload, () =>
                                    setRescheduleOpen(false),
                                )
                            }
                            labels={{
                                title: t(
                                    "pages.deals.workspace.meetings.reschedule_meeting",
                                ),
                                cancel: t("pages.deals.common.cancel"),
                                submit: t(
                                    "pages.deals.workspace.meetings.reschedule",
                                ),
                                newDate: t(
                                    "pages.deals.workspace.meetings.new_date",
                                ),
                                newStartTime: t(
                                    "pages.deals.workspace.meetings.new_start_time",
                                ),
                                duration: t(
                                    "pages.deals.workspace.meetings.duration",
                                ),
                                hideDuration: t(
                                    "pages.deals.workspace.meetings.hide_duration",
                                ),
                                addDuration: t(
                                    "pages.deals.workspace.meetings.add_duration",
                                ),
                                endTime: t(
                                    "pages.deals.workspace.meetings.end_time",
                                ),
                            }}
                        />
                    ) : null
                }
            />
        </>
    );
}
