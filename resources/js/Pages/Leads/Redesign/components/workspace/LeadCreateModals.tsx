import { Deferred, usePage } from "@inertiajs/react";
import { AddNoteModal, AddTaskModal, ScheduleMeetingModal } from "@/Components/Redesign";
import type { AddNoteFormState } from "@/Components/Redesign/modals/AddNoteModal";
import type { AddTaskFormState } from "@/Components/Redesign/modals/AddTaskModal";
import type { MeetingFormState } from "@/Components/Redesign/meeting/meetingFormUtils";
import { buildEmptyMeetingForm, getMeetingOwner } from "@/Components/Redesign/meeting/meetingFormUtils";
import LogActionModal from "@/Components/CrmEvents/LogActionModal";
import type { PageProps } from "@/Components/DashboardLayout";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTasksWorkspaceRedesignFlag from "@/Hooks/useTasksWorkspaceRedesignFlag";
import { LEAD_TIMELINE_MODEL_TYPE } from "@/Pages/Deals/Redesign/hooks/useDealTimeline";
import useTasksWorkspaceMutations from "@/Pages/Tasks/Redesign/hooks/useTasksWorkspaceMutations";
import useTaskExtras from "@/Pages/Tasks/Redesign/hooks/useTaskExtras";
import TaskRedesignFormModal from "@/Pages/Tasks/Redesign/components/embed/TaskRedesignFormModal";
import { formLinksPayload } from "@/Pages/Tasks/Redesign/adapters/taskFormValues";
import { afterCreateTaskFormSubmit, patchTaskListExtrasCounts } from "@/Pages/Tasks/Redesign/adapters/taskFormSubmitAdapter";
import type { Task as RedesignedTask } from "@/Types/Task";
import { useLeadWorkspace } from "../../context/LeadWorkspaceContext";
import useLeadMeetingCreate from "../../hooks/useLeadMeetingCreate";
import useLeadNoteCreate from "../../hooks/useLeadNoteCreate";
import useLeadTaskCreate from "../../hooks/useLeadTaskCreate";

export type LeadCreateKind = "note" | "task" | "meeting" | "log";

interface LeadCreateModalsProps {
    /** The one create form that is open, if any. */
    open: LeadCreateKind | null;
    /** Called on cancel and once a record is saved. */
    onClose: () => void;
    /** Set when the record is made from an email, so it links back to it. */
    sourceEmailMessageId?: string | null;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    taskBoardColumns: any[];
    taskCategories: any[];
}

/**
 * The lead's create forms: note, task, meeting and a logged activity. Each
 * one saves through the lead's own hooks and patches LeadWorkspaceContext,
 * so the new record shows up without a reload. Shared by the lead page and
 * the agent workspace's contact page.
 *
 * Behind crm.tasks-workspace-redesign, "Add task" opens the redesigned form
 * (checklist and attachment fields, multi-record links) instead of
 * AddTaskModal. Its mutation hook's own list patch is a no-op here: the
 * lead's task list is patched through addTask, as the older form does.
 */
export default function LeadCreateModals({
    open,
    onClose,
    sourceEmailMessageId = null,
    meetingTypes,
    taskBoardColumns,
    taskCategories,
}: LeadCreateModalsProps) {
    const { td } = useTd();
    const page = usePage<PageProps>();
    const { lead, addTask, setTasks } = useLeadWorkspace();

    const { createNote, isSaving: noteSaving, errors: noteErrors, clearErrors: clearNoteErrors } =
        useLeadNoteCreate(lead.id);
    const { createTask, isCreating: taskCreating, errors: taskErrors, clearErrors: clearTaskErrors } =
        useLeadTaskCreate(lead.id);
    const { createMeeting, isCreating: meetingCreating, errors: meetingErrors, clearErrors: clearMeetingErrors } =
        useLeadMeetingCreate(lead);

    const useRedesignedTasks = useTasksWorkspaceRedesignFlag();
    const { persistExtras } = useTaskExtras();
    const {
        createTask: createRedesignedTask,
        isCreating: isCreatingRedesignedTask,
        createErrors: createRedesignedTaskErrors,
        clearCreateErrors: clearCreateRedesignedErrors,
    } = useTasksWorkspaceMutations(() => {}, null);

    return (
        <>
            <LogActionModal
                open={open === "log"}
                onClose={onClose}
                onSuccess={onClose}
                modelType={LEAD_TIMELINE_MODEL_TYPE}
                modelId={lead.id}
                userId={page.props.auth?.user?.id}
            />

            <AddNoteModal
                open={open === "note"}
                onClose={() => {
                    onClose();
                    clearNoteErrors();
                }}
                saving={noteSaving}
                errors={noteErrors}
                onSubmit={(form: AddNoteFormState) =>
                    createNote(
                        {
                            title: form.title,
                            text: form.text,
                            sourceEmailMessageId,
                        },
                        onClose,
                    )
                }
                labels={{
                    title: td("Add note", { source: "en" }),
                    cancel: td("Cancel", { source: "en" }),
                    submit: td("Save note", { source: "en" }),
                    titleField: td("Title", { source: "en" }),
                    titlePlaceholder: td("Optional title", { source: "en" }),
                    detailsField: td("Details", { source: "en" }),
                    bodyPlaceholder: td("Write your note…", { source: "en" }),
                }}
            />

            {useRedesignedTasks ? (
                <Deferred data="taskCategories" fallback={null}>
                    <TaskRedesignFormModal
                        open={open === "task"}
                        mode="create"
                        columns={taskBoardColumns}
                        categories={taskCategories}
                        lockedLinks={[
                            {
                                type: "lead",
                                id: lead.id,
                                name: lead.client_name || "Lead",
                            },
                        ]}
                        saving={isCreatingRedesignedTask}
                        errors={createRedesignedTaskErrors}
                        onClose={() => {
                            onClose();
                            clearCreateRedesignedErrors();
                        }}
                        onSubmit={(values) =>
                            createRedesignedTask(
                                {
                                    title: values.title,
                                    startDate: values.startDate,
                                    dueDate: values.dueDate,
                                    dueTime: values.dueTime,
                                    priority: values.priority,
                                    description: values.description,
                                    assignees: values.assignees,
                                    categoryId: values.categoryId,
                                    boardColumnId: values.boardColumnId ?? undefined,
                                    links: formLinksPayload(values),
                                    sourceEmailMessageId,
                                },
                                afterCreateTaskFormSubmit(
                                    values,
                                    persistExtras,
                                    (task) => {
                                        if (task) {
                                            addTask(task as unknown as Parameters<typeof addTask>[0]);
                                        }
                                        onClose();
                                    },
                                    (task, result) => {
                                        setTasks(
                                            (prev) =>
                                                patchTaskListExtrasCounts(
                                                    prev as unknown as RedesignedTask[],
                                                    task.id,
                                                    result,
                                                ) as unknown as typeof prev,
                                        );
                                    },
                                ),
                            )
                        }
                    />
                </Deferred>
            ) : (
                <AddTaskModal
                    open={open === "task"}
                    onClose={() => {
                        onClose();
                        clearTaskErrors();
                    }}
                    saving={taskCreating}
                    errors={taskErrors}
                    defaultAssigneeUserId={lead.lead_owner?.id}
                    onSubmit={(form: AddTaskFormState) =>
                        createTask({ ...form, sourceEmailMessageId }, (task) => {
                            if (task) addTask(task);
                            onClose();
                        })
                    }
                    labels={{
                        title: td("Create task", { source: "en" }),
                        cancel: td("Cancel", { source: "en" }),
                        submit: td("Create task", { source: "en" }),
                        titleField: td("Title", { source: "en" }),
                        titlePlaceholder: td("What needs to be done?", { source: "en" }),
                        description: td("Description", { source: "en" }),
                        descriptionPlaceholder: td("Optional details", { source: "en" }),
                        startDate: td("Start date", { source: "en" }),
                        dueDate: td("Due date", { source: "en" }),
                        dueTime: td("Due time", { source: "en" }),
                        priority: td("Priority", { source: "en" }),
                        priorityHigh: td("High", { source: "en" }),
                        priorityMedium: td("Medium", { source: "en" }),
                        priorityLow: td("Low", { source: "en" }),
                        priorityHighest: td("Highest", { source: "en" }),
                        priorityUrgent: td("Urgent", { source: "en" }),
                        assignees: td("Assignees", { source: "en" }),
                        dateRangeError: td("Due date must be on or after start date", { source: "en" }),
                    }}
                />
            )}

            <ScheduleMeetingModal
                open={open === "meeting"}
                onClose={() => {
                    onClose();
                    clearMeetingErrors();
                }}
                saving={meetingCreating}
                errors={meetingErrors}
                meetingTypes={meetingTypes}
                initialForm={buildEmptyMeetingForm(
                    lead,
                    page.props.auth?.user?.id,
                    page.props.auth?.user?.email,
                )}
                onSubmit={(form: MeetingFormState) =>
                    createMeeting(
                        {
                            meetingTypeId: form.meetingTypeId,
                            date: form.date,
                            startTime: form.startTime,
                            endTime: form.endTime,
                            duration: form.duration,
                            platform: form.platform,
                            locationDetail: form.locationDetail,
                            meetingLink: form.meetingLink,
                            participants: form.participants,
                            hostId: form.hostId,
                            remark: form.remark,
                            reminders: form.reminders,
                            timezone: form.timezone,
                            sourceEmailMessageId,
                        },
                        onClose,
                    )
                }
                mustIncludeOwner={getMeetingOwner(lead)}
                labels={{
                    title: td("Schedule meeting", { source: "en" }),
                    cancel: td("Cancel", { source: "en" }),
                    submit: td("Schedule", { source: "en" }),
                }}
            />
        </>
    );
}
