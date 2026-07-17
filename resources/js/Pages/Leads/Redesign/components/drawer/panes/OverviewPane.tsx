import type { Lead } from "@/Types/api/leads";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { LeadNote } from "@/Types/api/lead-note";
import type { Task } from "@/Types/api/tasks";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { LeadDrawerTab } from "../../../types";
import useLeadOverview from "../../../hooks/useLeadOverview";
import OverviewNotesColumn from "./overview/OverviewNotesColumn";
import OverviewTasksColumn from "./overview/OverviewTasksColumn";
import OverviewMeetingsColumn from "./overview/OverviewMeetingsColumn";
import { OverviewColumnShell, OverviewColumnPendingSkeleton } from "./overview/overviewShared";

interface OverviewPaneProps {
    lead: Lead;
    notes?: LeadNote[];
    tasks?: Task[];
    leadFollowUps?: DealFollowup[];
    taskBoardColumns?: TaskboardColumn[];
    canAddNote?: boolean;
    canAddTask?: boolean;
    canAddMeeting?: boolean;
    onNavigate: (tab: LeadDrawerTab) => void;
    onAddTask: () => void;
    onAddMeeting: () => void;
    onNoteCreated?: (note: LeadNote) => void;
    onTaskStatusChange?: (
        taskId: number,
        statusSlug: string,
        rollbackTask?: Task,
    ) => void;
}

/** Chrome for each column renders immediately; only list bodies wait on data. */
export default function OverviewPane({
    lead,
    notes,
    tasks,
    leadFollowUps,
    taskBoardColumns = [],
    canAddNote = true,
    canAddTask = true,
    canAddMeeting = true,
    onNavigate,
    onAddTask,
    onAddMeeting,
    onNoteCreated,
    onTaskStatusChange,
}: OverviewPaneProps) {
    const overview = useLeadOverview({
        notes: notes ?? [],
        tasks: tasks ?? [],
        leadFollowUps: leadFollowUps ?? [],
    });

    return (
        <div className="grid grid-cols-1 gap-0 xl:grid-cols-3">
            <OverviewNotesColumn
                lead={lead}
                notes={overview.notes}
                isLoading={notes === undefined}
                canAdd={canAddNote}
                onViewNote={() => onNavigate("notes")}
                onNoteCreated={onNoteCreated}
            />
            <OverviewTasksColumn
                tasks={overview.tasks}
                rawTasks={tasks ?? []}
                taskBoardColumns={taskBoardColumns}
                openCount={overview.openTasksCount}
                isLoading={tasks === undefined}
                canAdd={canAddTask}
                onAddTask={onAddTask}
                onViewTask={() => onNavigate("tasks")}
                onTaskStatusChange={onTaskStatusChange}
            />
            {leadFollowUps === undefined ? (
                <OverviewColumnShell borderSide="right">
                    <OverviewColumnPendingSkeleton />
                </OverviewColumnShell>
            ) : (
                <OverviewMeetingsColumn
                    meetings={overview.meetings}
                    upcomingCount={overview.upcomingMeetingsCount}
                    canAdd={canAddMeeting}
                    onAddMeeting={onAddMeeting}
                    onViewMeeting={() => onNavigate("meetings")}
                />
            )}
        </div>
    );
}
