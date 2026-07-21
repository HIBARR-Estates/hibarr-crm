import { ReactNode, useState } from "react";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Note } from "@/Types/api/note";
import type { Task } from "@/Types/api/tasks";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import TaskStatusDropdownPill from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import useTranslation from "@/Hooks/useTranslation";
import DealAvatar from "../primitives/DealAvatar";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import useWorkspaceOverview from "../../hooks/useWorkspaceOverview";
import useDealTaskStatus from "../../hooks/useDealTaskStatus";
import { DealTab } from "../../types";
import DealNoteDetailModal from "./DealNoteDetailModal";
import DealTaskDetailModal from "./DealTaskDetailModal";
import DealMeetingDetailModal from "./DealMeetingDetailModal";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface WorkspaceOverviewTabProps {
    deal: Deal;
    notes: Note[];
    tasks: Task[];
    dealFollowUps: DealFollowup[];
    taskBoardColumns: TaskboardColumn[];
    permissions: Record<string, string>;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    onNavigateToSubTab: (tab: DealTab) => void;
    onAddTask: () => void;
    onAddMeeting: () => void;
    onAddNote: () => void;
}

interface EmptyMeta {
    icon: string;
    title: string;
    hint: string;
    actionLabel: string;
}

function OverviewColumn({
    title,
    count,
    total,
    onAdd,
    onViewAll,
    empty,
    isEmpty,
    children,
}: {
    title: string;
    count: number;
    total: number;
    onAdd: () => void;
    onViewAll: () => void;
    empty: EmptyMeta;
    isEmpty: boolean;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div className="dr-ov-col">
            <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="dr-label">
                    {title} <span style={{ fontWeight: 400 }}>· {count}</span>
                </span>
                {!isEmpty && (
                    <DealButton
                        variant="ghost"
                        size="sm"
                        onClick={onAdd}
                        aria-label={`${t("pages.deals.workspace.overview.add")} — ${title}`}
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
                        <DealButton variant="primary" onClick={onAdd}>
                            + {empty.actionLabel}
                        </DealButton>
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
                    {t("pages.deals.workspace.overview.view_all")} {total} →
                </button>
            )}
        </div>
    );
}

export default function WorkspaceOverviewTab({
    deal,
    notes,
    tasks,
    dealFollowUps,
    taskBoardColumns,
    permissions,
    meetingTypes,
    onNavigateToSubTab,
    onAddTask,
    onAddMeeting,
    onAddNote,
}: WorkspaceOverviewTabProps) {
    const { t } = useTranslation();
    const overview = useWorkspaceOverview({ notes, tasks, dealFollowUps });
    const { setStatus, isPending } = useDealTaskStatus();
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedMeeting, setSelectedMeeting] = useState<DealFollowup | null>(null);

    const canEditMeetings = permissions.edit_lead_follow_up !== "none";
    const canDeleteMeetings = permissions.delete_lead_follow_up !== "none";

    const topNotes = overview.notes.slice(0, 5);
    const openTasks = overview.tasks.filter((task) => task.isOpen);
    const topTasks = openTasks.slice(0, 5);
    const upcomingMeetings = overview.meetings.filter((meeting) => meeting.isUpcoming);
    const topMeetings = upcomingMeetings.slice(0, 5);

    const rawTask = (id: number) => tasks.find((task) => task.id === id) ?? null;
    const rawNote = (id: number) => notes.find((note) => note.id === id) ?? null;
    const rawMeeting = (id: number) =>
        dealFollowUps.find((meeting) => meeting.id === id) ?? null;

    return (
        <div className="dr-overview">
            <OverviewColumn
                title={t("pages.deals.tabs.notes")}
                count={notes.length}
                total={notes.length}
                onAdd={onAddNote}
                onViewAll={() => onNavigateToSubTab("notes")}
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
                                className="shrink-0 text-[11px]"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {note.timeLabel}
                            </span>
                        </div>
                        <div
                            className="dr-clamp-2 text-xs leading-relaxed"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {note.body}
                        </div>
                    </button>
                ))}
            </OverviewColumn>

            <OverviewColumn
                title={t("pages.deals.workspace.overview.open_tasks_col")}
                count={openTasks.length}
                total={tasks.length}
                onAdd={onAddTask}
                onViewAll={() => onNavigateToSubTab("tasks")}
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
                                    className="mt-[3px] flex items-center gap-1 text-[11px]"
                                    style={{
                                        color: overdue ? T.RED : T.TEXT_MUTED,
                                        fontWeight: overdue ? 600 : 400,
                                    }}
                                >
                                    <DealIcon name="calendar" size={11} />
                                    {task.dueDateLabel}
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

            <OverviewColumn
                title={t("pages.deals.workspace.overview.upcoming_meetings_col")}
                count={upcomingMeetings.length}
                total={dealFollowUps.length}
                onAdd={onAddMeeting}
                onViewAll={() => onNavigateToSubTab("meetings")}
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
                            <button
                                type="button"
                                onClick={() => setSelectedMeeting(raw)}
                                className="w-10 shrink-0 cursor-pointer self-start rounded-md px-1 py-1.5 text-center"
                                style={{
                                    background: T.BLUE_LIGHT,
                                    border: `1px solid ${T.BLUE_MID}`,
                                }}
                            >
                                <span
                                    className="block text-[11px] uppercase"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {meeting.monthLabel}
                                </span>
                                <span
                                    className="block text-[15px] font-bold leading-none"
                                    style={{ color: "#14538c" }}
                                >
                                    {meeting.dayLabel}
                                </span>
                            </button>
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
                                    className="mt-[3px] block text-[11px]"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {meeting.timeLabel}
                                </span>
                                {meeting.attendeesLabel && (
                                    <span
                                        className="mt-[3px] flex items-center gap-1 text-[11px]"
                                        style={{ color: T.TEXT_MUTED }}
                                    >
                                        <DealIcon name="users" size={11} />
                                        {meeting.attendeesLabel}
                                    </span>
                                )}
                            </button>
                            {/* v2.2's Join button on upcoming video meetings
                                (deal-v2-2.jsx:1561-1567) */}
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

            <DealNoteDetailModal
                note={selectedNote}
                permissions={permissions}
                onClose={() => setSelectedNote(null)}
            />
            <DealTaskDetailModal
                task={selectedTask}
                taskBoardColumns={taskBoardColumns}
                onClose={() => setSelectedTask(null)}
            />
            <DealMeetingDetailModal
                meeting={selectedMeeting}
                deal={deal}
                meetingTypes={meetingTypes}
                canEdit={canEditMeetings}
                canDelete={canDeleteMeetings}
                onClose={() => setSelectedMeeting(null)}
            />
        </div>
    );
}
