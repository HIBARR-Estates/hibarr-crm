import type { Lead } from "@/Types/api/leads";
import type { Task } from "@/Types/api/tasks";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { LeadDrawerTab } from "../../../types";
import type useLeadOverview from "../../../hooks/useLeadOverview";
import OverviewNotesColumn from "./overview/OverviewNotesColumn";
import OverviewTasksColumn from "./overview/OverviewTasksColumn";
import OverviewMeetingsColumn from "./overview/OverviewMeetingsColumn";

type OverviewData = ReturnType<typeof useLeadOverview>;

interface OverviewPaneProps {
    lead: Lead;
    overview: OverviewData;
    tasks: Task[];
    taskBoardColumns: TaskboardColumn[];
    canAddNote?: boolean;
    canAddTask?: boolean;
    canAddMeeting?: boolean;
    onNavigate: (tab: LeadDrawerTab) => void;
    onAddTask: () => void;
    onAddMeeting: () => void;
}

export default function OverviewPane({
    lead,
    overview,
    tasks,
    taskBoardColumns,
    canAddNote = true,
    canAddTask = true,
    canAddMeeting = true,
    onNavigate,
    onAddTask,
    onAddMeeting,
}: OverviewPaneProps) {
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
