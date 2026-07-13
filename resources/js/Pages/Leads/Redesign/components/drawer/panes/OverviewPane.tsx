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

interface OverviewPaneProps {
    lead: Lead;
    notes: LeadNote[];
    tasks: Task[];
    leadFollowUps: DealFollowup[];
    taskBoardColumns: TaskboardColumn[];
    canAddNote?: boolean;
    canAddTask?: boolean;
    canAddMeeting?: boolean;
    onNavigate: (tab: LeadDrawerTab) => void;
    onAddTask: () => void;
    onAddMeeting: () => void;
}

/** Mounted only inside `<Deferred>` after notes/tasks/follow-ups resolve (C4). */
export default function OverviewPane({
    lead,
    notes,
    tasks,
    leadFollowUps,
    taskBoardColumns,
    canAddNote = true,
    canAddTask = true,
    canAddMeeting = true,
    onNavigate,
    onAddTask,
    onAddMeeting,
}: OverviewPaneProps) {
    const overview = useLeadOverview({ notes, tasks, leadFollowUps });

    return (
        <div className="grid grid-cols-1 gap-0 xl:grid-cols-3">
            <OverviewNotesColumn
                lead={lead}
                notes={overview.notes}
                canAdd={canAddNote}
                onViewNote={() => onNavigate("notes")}
            />
            <OverviewTasksColumn
                tasks={overview.tasks}
                rawTasks={tasks}
                taskBoardColumns={taskBoardColumns}
                openCount={overview.openTasksCount}
                canAdd={canAddTask}
                onAddTask={onAddTask}
                onViewTask={() => onNavigate("tasks")}
            />
            <OverviewMeetingsColumn
                meetings={overview.meetings}
                upcomingCount={overview.upcomingMeetingsCount}
                canAdd={canAddMeeting}
                onAddMeeting={onAddMeeting}
                onViewMeeting={() => onNavigate("meetings")}
            />
        </div>
    );
}
