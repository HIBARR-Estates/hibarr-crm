import { useMemo, useState, type ReactNode } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    AddNoteModal,
    AddTaskModal,
    Button,
    NoteDetailModal,
    ScheduleMeetingModal,
    TaskDetailModal,
    MeetingDetailModal,
} from "@/Components/Redesign";
import { usePage } from "@inertiajs/react";
import type { AddNoteFormState } from "@/Components/Redesign/modals/AddNoteModal";
import type { AddTaskFormState } from "@/Components/Redesign/modals/AddTaskModal";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { LeadNote } from "@/Types/api/lead-note";
import type { Task } from "@/Types/api/tasks";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import TaskStatusDropdownPill from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import {
    buildEmptyMeetingForm,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import { toLeadNotePreview } from "../../../adapters/noteAdapter";
import { toLeadMeetingPreview } from "../../../adapters/meetingAdapter";
import { toLeadTaskPreview } from "../../../adapters/taskAdapter";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadNoteCreate from "../../../hooks/useLeadNoteCreate";
import useLeadTaskCreate from "../../../hooks/useLeadTaskCreate";
import useLeadMeetingCreate from "../../../hooks/useLeadMeetingCreate";
import useLeadTaskStatus from "../../../hooks/useLeadTaskStatus";
import type { WorkspaceTabId } from "../../../types";
import NoteCard from "../cards/NoteCard";
import TaskCard from "../cards/TaskCard";
import MeetingCard from "../cards/MeetingCard";

const PREVIEW_LIMIT = 3;

interface OverviewTabProps {
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    taskBoardColumns: TaskboardColumn[];
    onNavigateTab: (tab: WorkspaceTabId) => void;
}

function OverviewSection({
    title,
    count,
    emptyTitle,
    emptyHint,
    actionLabel,
    onAdd,
    onViewAll,
    isEmpty,
    children,
}: {
    title: string;
    count: number;
    emptyTitle: string;
    emptyHint: string;
    actionLabel: string;
    onAdd: () => void;
    onViewAll: () => void;
    isEmpty: boolean;
    children: ReactNode;
}) {
    return (
        <div className="border-r border-[#e2e5ea] p-4 last:border-r-0">
            <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                    {title} · {count}
                </span>
                {!isEmpty && (
                    <button
                        type="button"
                        className="v2-btn-link !px-0 !py-0 text-[#1a6bb5]"
                        onClick={onAdd}
                    >
                        + Add
                    </button>
                )}
            </div>
            {isEmpty ? (
                <div className="rounded-[10px] border border-dashed border-[#e2e5ea] px-3 py-5 text-center">
                    <p className="mb-1 text-[13px] font-semibold text-[#1a1f2e]">
                        {emptyTitle}
                    </p>
                    <p className="mb-3 text-xs text-[#6b7280]">{emptyHint}</p>
                    <Button variant="primary" onClick={onAdd}>
                        + {actionLabel}
                    </Button>
                </div>
            ) : (
                children
            )}
            {count > 0 && (
                <button
                    type="button"
                    className="mt-2 cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[#1a6bb5]"
                    onClick={onViewAll}
                >
                    View all →
                </button>
            )}
        </div>
    );
}

export default function OverviewTab({
    meetingTypes,
    taskBoardColumns,
    onNavigateTab,
}: OverviewTabProps) {
    const { td } = useTd();
    const { props } = usePage();
    const { lead, notes, tasks, leadFollowUps, addNote, addTask } =
        useLeadWorkspace();

    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [selectedNote, setSelectedNote] = useState<LeadNote | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedMeeting, setSelectedMeeting] =
        useState<DealFollowup | null>(null);

    const { createNote, isSaving: isSavingNote, errors: noteErrors } =
        useLeadNoteCreate(lead.id);
    const { createTask, isCreating: isCreatingTask, errors: taskErrors } =
        useLeadTaskCreate(lead.id);
    const {
        createMeeting,
        isCreating: isCreatingMeeting,
        errors: meetingErrors,
    } = useLeadMeetingCreate(lead);
    const { setStatus, isPending } = useLeadTaskStatus();

    const notePreviews = useMemo(
        () => notes.slice(0, PREVIEW_LIMIT).map(toLeadNotePreview),
        [notes],
    );
    const openTasks = useMemo(
        () => tasks.filter((t) => toLeadTaskPreview(t).isOpen),
        [tasks],
    );
    const taskPreviews = useMemo(
        () => openTasks.slice(0, PREVIEW_LIMIT).map(toLeadTaskPreview),
        [openTasks],
    );
    const meetingPreviews = useMemo(() => {
        const sorted = [...leadFollowUps].sort((a, b) => {
            const aTime = new Date(a.next_follow_up_date ?? 0).getTime();
            const bTime = new Date(b.next_follow_up_date ?? 0).getTime();
            return bTime - aTime;
        });
        return sorted.slice(0, PREVIEW_LIMIT).map(toLeadMeetingPreview);
    }, [leadFollowUps]);

    const meetingInitialForm = useMemo(
        () => buildEmptyMeetingForm(null, props.auth?.user?.id),
        [props.auth?.user?.id],
    );

    return (
        <>
            <div className="v2-overview-grid">
                <OverviewSection
                    title="Notes"
                    count={notes.length}
                    emptyTitle="No notes yet"
                    emptyHint="Capture context from calls and conversations."
                    actionLabel="Add note"
                    onAdd={() => setNoteModalOpen(true)}
                    onViewAll={() => onNavigateTab("notes")}
                    isEmpty={notes.length === 0}
                >
                    {notePreviews.map((note) => {
                        const raw = notes.find((n) => n.id === note.id);
                        return (
                            <NoteCard
                                key={note.id}
                                note={note}
                                onClick={() => raw && setSelectedNote(raw)}
                            />
                        );
                    })}
                </OverviewSection>

                <OverviewSection
                    title="Tasks"
                    count={openTasks.length}
                    emptyTitle="No open tasks"
                    emptyHint="Track follow-ups and action items for this lead."
                    actionLabel="Create task"
                    onAdd={() => setTaskModalOpen(true)}
                    onViewAll={() => onNavigateTab("tasks")}
                    isEmpty={openTasks.length === 0}
                >
                    {taskPreviews.map((preview) => {
                        const raw = tasks.find((t) => t.id === preview.id);
                        return (
                            <TaskCard
                                key={preview.id}
                                task={preview}
                                onClick={() => raw && setSelectedTask(raw)}
                                statusControl={
                                    raw ? (
                                        <TaskStatusDropdownPill
                                            status={
                                                (
                                                    raw as Task & {
                                                        board_column?: {
                                                            slug?: string;
                                                        };
                                                    }
                                                ).board_column?.slug ||
                                                raw.status ||
                                                "to_do"
                                            }
                                            columns={taskBoardColumns}
                                            onChange={(slug) =>
                                                setStatus(raw.id, slug)
                                            }
                                            loading={isPending(raw.id)}
                                            disabled={isPending(raw.id)}
                                        />
                                    ) : undefined
                                }
                            />
                        );
                    })}
                </OverviewSection>

                <OverviewSection
                    title="Meetings"
                    count={leadFollowUps.length}
                    emptyTitle="No meetings scheduled"
                    emptyHint="Book the next conversation with this lead."
                    actionLabel="Schedule"
                    onAdd={() => setMeetingModalOpen(true)}
                    onViewAll={() => onNavigateTab("meetings")}
                    isEmpty={leadFollowUps.length === 0}
                >
                    {meetingPreviews.map((meeting) => {
                        const raw = leadFollowUps.find(
                            (m) => m.id === meeting.id,
                        );
                        return (
                            <MeetingCard
                                key={meeting.id}
                                meeting={meeting}
                                onClick={() => raw && setSelectedMeeting(raw)}
                            />
                        );
                    })}
                </OverviewSection>
            </div>

            <AddNoteModal
                open={noteModalOpen}
                onClose={() => setNoteModalOpen(false)}
                saving={isSavingNote}
                errors={noteErrors}
                onSubmit={(form: AddNoteFormState) =>
                    createNote({ text: form.text || form.title }, (note) => {
                        addNote(note);
                        setNoteModalOpen(false);
                    })
                }
                labels={{
                    title: td("Add note"),
                    cancel: td("Cancel"),
                    submit: td("Save note"),
                    titleField: td("Title"),
                    titlePlaceholder: td("Optional title"),
                    detailsField: td("Details"),
                    bodyPlaceholder: td("Write your note…"),
                }}
            />

            <AddTaskModal
                open={taskModalOpen}
                onClose={() => setTaskModalOpen(false)}
                saving={isCreatingTask}
                errors={taskErrors}
                defaultAssigneeUserId={lead.lead_owner?.id}
                onSubmit={(form: AddTaskFormState) =>
                    createTask(form, (task) => {
                        if (task) addTask(task);
                        setTaskModalOpen(false);
                    })
                }
                labels={{
                    title: td("Create task"),
                    cancel: td("Cancel"),
                    submit: td("Create task"),
                    titleField: td("Title"),
                    titlePlaceholder: td("What needs to be done?"),
                    description: td("Description"),
                    descriptionPlaceholder: td("Optional details"),
                    startDate: td("Start date"),
                    dueDate: td("Due date"),
                    dueTime: td("Due time"),
                    priority: td("Priority"),
                    priorityHigh: td("High"),
                    priorityMedium: td("Medium"),
                    priorityLow: td("Low"),
                    assignees: td("Assignees"),
                    dateRangeError: td("Due date must be on or after start date"),
                }}
            />

            <ScheduleMeetingModal
                open={meetingModalOpen}
                onClose={() => setMeetingModalOpen(false)}
                saving={isCreatingMeeting}
                errors={meetingErrors}
                meetingTypes={meetingTypes}
                initialForm={meetingInitialForm}
                onSubmit={(form: MeetingFormState) =>
                    createMeeting(
                        {
                            meetingTypeId: form.meetingTypeId,
                            date: form.date,
                            startTime: form.startTime,
                            endTime: form.endTime,
                            duration: form.duration,
                            platform: form.platform,
                            meetingLink: form.meetingLink,
                            participants: form.participants,
                            remark: form.remark,
                            reminders: form.reminders,
                        },
                        () => setMeetingModalOpen(false),
                    )
                }
                labels={{
                    title: td("Schedule meeting"),
                    cancel: td("Cancel"),
                    submit: td("Schedule"),
                }}
            />

            <NoteDetailModal
                note={selectedNote}
                onClose={() => setSelectedNote(null)}
                canEdit={false}
                canDelete={false}
                isUpdating={false}
                isDeleting={false}
                onUpdate={() => {}}
                onDelete={() => {}}
                labels={{
                    viewTitle: td("Note"),
                    editTitle: td("Edit note"),
                    cancel: td("Cancel"),
                    save: td("Save"),
                    delete: td("Delete"),
                    edit: td("Edit"),
                    titleField: td("Title"),
                    detailsField: td("Details"),
                    editedTag: td("Edited"),
                    unknownAuthor: td("Unknown"),
                    deleteConfirmTitle: td("Delete note?"),
                    deleteConfirmMessage: td("This cannot be undone."),
                    deleteConfirmLabel: td("Delete"),
                }}
            />

            <TaskDetailModal
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                taskBoardColumns={taskBoardColumns}
                canWrite={false}
                isStatusPending={
                    selectedTask ? isPending(selectedTask.id) : false
                }
                isUpdating={false}
                errors={[]}
                clearErrors={() => {}}
                onUpdate={() => {}}
                onStatusChange={(slug) =>
                    selectedTask && setStatus(selectedTask.id, slug)
                }
                labels={{
                    viewTitle: td("Task"),
                    editTitle: td("Edit task"),
                    cancel: td("Cancel"),
                    save: td("Save"),
                    delete: td("Delete"),
                    edit: td("Edit"),
                    titleField: td("Title"),
                    description: td("Description"),
                    descriptionPlaceholder: td("Optional details"),
                    startDate: td("Start date"),
                    dueDate: td("Due date"),
                    dueTime: td("Due time"),
                    priority: td("Priority"),
                    priorityHigh: td("High"),
                    priorityMedium: td("Medium"),
                    priorityLow: td("Low"),
                    assignees: td("Assignees"),
                    overdue: td("Overdue"),
                    noDescription: td("No description"),
                    unassigned: td("Unassigned"),
                    dateRangeError: td(
                        "Due date must be on or after start date",
                    ),
                }}
            />

            <MeetingDetailModal
                meeting={selectedMeeting}
                canEdit={false}
                canDelete={false}
                onClose={() => setSelectedMeeting(null)}
                isUpdating={false}
                onCancelMeeting={() => {}}
            />
        </>
    );
}
