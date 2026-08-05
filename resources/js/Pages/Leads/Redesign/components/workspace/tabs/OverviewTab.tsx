import { ReactNode, useState } from "react";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { LeadNote } from "@/Types/api/lead-note";
import type { Task } from "@/Types/api/tasks";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import TaskStatusDropdownPill from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import useTranslation from "@/Hooks/useTranslation";
import useWorkspaceOverview from "@/Pages/Deals/Redesign/hooks/useWorkspaceOverview";
import DealAvatar from "@/Pages/Deals/Redesign/components/primitives/DealAvatar";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import DealDateBlock from "@/Pages/Deals/Redesign/components/primitives/DealDateBlock";
import DealIcon from "@/Pages/Deals/Redesign/components/primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadTaskStatus from "../../../hooks/useLeadTaskStatus";
import type { WorkspaceTabId } from "../../../types";
import LeadNoteDetailModal from "../LeadNoteDetailModal";
import LeadTaskDetailModal from "../LeadTaskDetailModal";
import LeadMeetingDetailModal from "../LeadMeetingDetailModal";

interface LeadWorkspacePermissions {
    notes?: Record<string, string>;
    tasks?: Record<string, string>;
    followUps?: Record<string, string>;
}

interface OverviewTabProps {
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    taskBoardColumns: TaskboardColumn[];
    permissions?: LeadWorkspacePermissions;
    onNavigateTab: (tab: WorkspaceTabId) => void;
    onAddNote: () => void;
    onAddTask: () => void;
    onAddMeeting: () => void;
}

interface EmptyMeta {
    icon: string;
    title: string;
    hint: string;
    actionLabel: string;
}

function permAllowed(
    permissions: Record<string, string> | undefined,
    key: string,
): boolean {
    if (!permissions) return true;
    return permissions[key] !== "none";
}

function OverviewColumn({
    title,
    count,
    total,
    onAdd,
    onViewAll,
    empty,
    isEmpty,
    canAdd = true,
    children,
}: {
    title: string;
    count: number;
    total: number;
    onAdd: () => void;
    onViewAll: () => void;
    empty: EmptyMeta;
    isEmpty: boolean;
    canAdd?: boolean;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div className="dr-ov-col">
            <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="dr-label">
                    {title} <span style={{ fontWeight: 400 }}>· {count}</span>
                </span>
                {!isEmpty && canAdd && (
                    <DealButton
                        variant="ghost"
                        size="sm"
                        onClick={onAdd}
                        aria-label={`${t("pages.deals.workspace.overview.add")} - ${title}`}
                    >
                        + {t("pages.deals.workspace.overview.add")}
                    </DealButton>
                )}
            </div>
            <div className="flex-1">
                {isEmpty ? (
                    <div
                        role="status"
                        className="rounded-[10px] border border-dashed px-3.5 py-[22px] text-center"
                        style={{ borderColor: T.BORDER, background: T.SURFACE }}
                    >
                        <div
                            aria-hidden="true"
                            className="mx-auto mb-2 flex h-[38px] w-[38px] items-center justify-center rounded-full"
                            style={{ background: T.BLUE_LIGHT }}
                        >
                            <DealIcon name={empty.icon} size={17} color="#14538c" />
                        </div>
                        <div className="mb-[3px] text-[13px] font-semibold text-[#1a1f2e]">
                            {empty.title}
                        </div>
                        <div className="mb-3 text-xs leading-relaxed text-[#5b6472]">
                            {empty.hint}
                        </div>
                        {canAdd && (
                            <DealButton variant="primary" onClick={onAdd}>
                                + {empty.actionLabel}
                            </DealButton>
                        )}
                    </div>
                ) : (
                    children
                )}
            </div>
            {total > 0 && (
                <button
                    type="button"
                    onClick={onViewAll}
                    className="mt-2 cursor-pointer border-none bg-transparent px-0 py-1.5 text-left text-xs font-semibold"
                    style={{ color: T.BLUE }}
                >
                    {t("pages.deals.workspace.overview.view_all")} →
                </button>
            )}
        </div>
    );
}

export default function OverviewTab({
    meetingTypes,
    taskBoardColumns,
    permissions,
    onNavigateTab,
    onAddNote,
    onAddTask,
    onAddMeeting,
}: OverviewTabProps) {
    const { t } = useTranslation();
    const { notes, tasks, leadFollowUps } = useLeadWorkspace();
    const { setStatus, isPending } = useLeadTaskStatus();
    const [selectedNote, setSelectedNote] = useState<LeadNote | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedMeeting, setSelectedMeeting] = useState<DealFollowup | null>(
        null,
    );

    const overview = useWorkspaceOverview({
        notes: notes as Parameters<typeof useWorkspaceOverview>[0]["notes"],
        tasks,
        dealFollowUps: leadFollowUps,
    });

    const notePerms = permissions?.notes;
    const taskPerms = permissions?.tasks;
    const followUpPerms = permissions?.followUps;

    const canViewNotes = permAllowed(notePerms, "view_lead_note");
    const canViewTasks = permAllowed(taskPerms, "view_tasks");
    const canViewMeetings = permAllowed(followUpPerms, "view_lead_follow_up");
    const canAddNote =
        !notePerms || notePerms.add_lead_note !== "none";
    const canAddTask = !taskPerms || taskPerms.add_tasks !== "none";
    const canAddMeeting =
        !followUpPerms || followUpPerms.add_lead_follow_up !== "none";

    const topNotes = overview.notes.slice(0, 5);
    const openTasks = overview.tasks.filter((task) => task.isOpen);
    const topTasks = openTasks.slice(0, 5);
    const upcomingMeetings = overview.meetings.filter(
        (meeting) => meeting.isUpcoming,
    );
    const topMeetings = upcomingMeetings.slice(0, 5);

    const rawTask = (id: number) => tasks.find((task) => task.id === id) ?? null;
    const rawNote = (id: number) => notes.find((note) => note.id === id) ?? null;
    const rawMeeting = (id: number) =>
        leadFollowUps.find((meeting) => meeting.id === id) ?? null;

    return (
        <div className="dr-overview">
            {canViewNotes && (
                <OverviewColumn
                    canAdd={canAddNote}
                    title={t("pages.deals.tabs.notes")}
                    count={notes.length}
                    total={notes.length}
                    onAdd={onAddNote}
                    onViewAll={() => onNavigateTab("notes")}
                    isEmpty={topNotes.length === 0}
                    empty={{
                        icon: "file-text",
                        title: t("pages.deals.workspace.overview.notes_empty_title"),
                        hint: t("pages.deals.workspace.overview.notes_empty_hint"),
                        actionLabel: t("pages.deals.workspace.notes.add_note"),
                    }}
                >
                    {topNotes.map((note) => (
                        <button
                            key={note.id}
                            type="button"
                            className="dr-card dr-card-btn mb-2 w-full cursor-pointer text-left"
                            style={{ padding: "10px 12px" }}
                            onClick={() => setSelectedNote(rawNote(note.id))}
                        >
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <DealAvatar size={20} initials={note.authorInitials} />
                                    <span className="truncate text-xs font-semibold">
                                        {note.title || note.authorName}
                                    </span>
                                </span>
                                <span
                                    className="shrink-0 text-[12px]"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {note.timeLabel}
                                </span>
                            </div>
                            <div
                                className="dr-clamp-3 min-w-0 text-xs leading-relaxed"
                                style={{
                                    color: T.TEXT_MUTED,
                                    overflowWrap: "anywhere",
                                    wordBreak: "break-word",
                                }}
                            >
                                {note.body}
                            </div>
                        </button>
                    ))}
                </OverviewColumn>
            )}

            {canViewTasks && (
                <OverviewColumn
                    canAdd={canAddTask}
                    title={t("pages.deals.workspace.overview.open_tasks_col")}
                    count={openTasks.length}
                    total={tasks.length}
                    onAdd={onAddTask}
                    onViewAll={() => onNavigateTab("tasks")}
                    isEmpty={topTasks.length === 0}
                    empty={{
                        icon: "check-square",
                        title: t("pages.deals.workspace.overview.tasks_empty_title"),
                        hint: t("pages.deals.workspace.overview.tasks_empty_hint"),
                        actionLabel: t("pages.deals.workspace.tasks.add_task"),
                    }}
                >
                    {topTasks.map((task) => {
                        const raw = rawTask(task.id);
                        const overdue =
                            task.dueDate != null &&
                            task.dueDate.getTime() < Date.now() &&
                            task.isOpen;
                        return (
                            <div
                                key={task.id}
                                className="dr-card mb-2 flex items-center gap-2"
                                style={{ padding: "8px 10px" }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setSelectedTask(raw)}
                                    className="min-w-0 flex-1 cursor-pointer border-none bg-transparent px-0 py-1 text-left"
                                >
                                    <div className="text-xs font-semibold">{task.title}</div>
                                    <div
                                        className="mt-[3px] flex items-center gap-1 text-[12px]"
                                        style={{
                                            color: overdue ? T.RED : T.TEXT_MUTED,
                                            fontWeight: overdue ? 600 : 400,
                                        }}
                                    >
                                        <DealIcon name="calendar" size={11} />
                                        {task.dueDateLabel || t("pages.deals.common.no_due_date")}
                                        {overdue
                                            ? ` · ${t("pages.deals.workspace.tasks.overdue")}`
                                            : ""}
                                    </div>
                                </button>
                                {raw && (
                                    <TaskStatusDropdownPill
                                        status={
                                            (raw as Task & { board_column?: { slug?: string } })
                                                .board_column?.slug ||
                                            raw.status ||
                                            "to_do"
                                        }
                                        columns={taskBoardColumns}
                                        loading={isPending(raw.id)}
                                        onChange={(slug) => setStatus(raw.id, slug)}
                                    />
                                )}
                            </div>
                        );
                    })}
                </OverviewColumn>
            )}

            {canViewMeetings && (
                <OverviewColumn
                    canAdd={canAddMeeting}
                    title={t("pages.deals.workspace.overview.upcoming_meetings_col")}
                    count={upcomingMeetings.length}
                    total={leadFollowUps.length}
                    onAdd={onAddMeeting}
                    onViewAll={() => onNavigateTab("meetings")}
                    isEmpty={topMeetings.length === 0}
                    empty={{
                        icon: "calendar",
                        title: t("pages.deals.workspace.overview.meetings_empty_title"),
                        hint: t("pages.deals.workspace.overview.meetings_empty_hint"),
                        actionLabel: t("pages.deals.workspace.meetings.schedule"),
                    }}
                >
                    {topMeetings.map((meeting) => {
                        const raw = rawMeeting(meeting.id);
                        const typeColor = raw?.meeting_type?.color || T.TEXT_MUTED;
                        return (
                            <div
                                key={meeting.id}
                                className="dr-card mb-2 flex gap-2.5"
                                style={{ padding: "10px 12px" }}
                            >
                                <DealDateBlock
                                    monthLabel={meeting.monthLabel}
                                    dayLabel={meeting.dayLabel}
                                    onClick={() => setSelectedMeeting(raw)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setSelectedMeeting(raw)}
                                    className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <span
                                            aria-hidden="true"
                                            className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
                                            style={{ background: typeColor }}
                                        />
                                        <span className="text-xs font-semibold">
                                            {meeting.title}
                                        </span>
                                    </span>
                                    <span
                                        className="mt-[3px] block text-[12px]"
                                        style={{ color: T.TEXT_MUTED }}
                                    >
                                        {meeting.timeLabel}
                                    </span>
                                    {meeting.attendeesLabel && (
                                        <span
                                            className="mt-[3px] flex items-center gap-1 text-[12px]"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            <DealIcon name="users" size={11} />
                                            {meeting.attendeesLabel}
                                        </span>
                                    )}
                                </button>
                                {meeting.locationType === "video" &&
                                    meeting.status === "scheduled" && (
                                        <DealButton
                                            variant="primary"
                                            size="sm"
                                            className="self-start"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                window.open(
                                                    meeting.location,
                                                    "_blank",
                                                    "noopener,noreferrer",
                                                );
                                            }}
                                        >
                                            <DealIcon name="video" size={12} />
                                            {t("pages.deals.workspace.overview.join")}
                                        </DealButton>
                                    )}
                            </div>
                        );
                    })}
                </OverviewColumn>
            )}

            <LeadNoteDetailModal
                note={selectedNote}
                permissions={notePerms}
                onClose={() => setSelectedNote(null)}
            />
            <LeadTaskDetailModal
                task={selectedTask}
                taskBoardColumns={taskBoardColumns}
                permissions={permissions?.tasks}
                onClose={() => setSelectedTask(null)}
            />
            <LeadMeetingDetailModal
                meeting={selectedMeeting}
                meetingTypes={meetingTypes}
                permissions={followUpPerms}
                onClose={() => setSelectedMeeting(null)}
            />
        </div>
    );
}
