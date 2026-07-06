import type { Deal } from "@/Types/api/deals";
import type { Task } from "@/Types/api/tasks";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import useWorkspaceOverview from "../../../hooks/useWorkspaceOverview";
import type { WorkspaceSubTab } from "../../../types";
import OverviewMeetingsColumn from "./overview/OverviewMeetingsColumn";
import OverviewNotesColumn from "./overview/OverviewNotesColumn";
import OverviewTasksColumn from "./overview/OverviewTasksColumn";

interface WorkspaceOverviewTabProps {
    deal: Deal;
    notes: Parameters<typeof useWorkspaceOverview>[0]["notes"];
    tasks: Task[];
    dealFollowUps: Parameters<typeof useWorkspaceOverview>[0]["dealFollowUps"];
    taskBoardColumns: TaskboardColumn[];
    onNavigateToSubTab: (tab: WorkspaceSubTab) => void;
    onAddTask: () => void;
    onAddMeeting: () => void;
}

export default function WorkspaceOverviewTab({
    deal,
    notes,
    tasks,
    dealFollowUps,
    taskBoardColumns,
    onNavigateToSubTab,
    onAddTask,
    onAddMeeting,
}: WorkspaceOverviewTabProps) {
    const overview = useWorkspaceOverview({ notes, tasks, dealFollowUps });

    return (
        <div className="grid grid-cols-1 gap-0 xl:grid-cols-3">
            <OverviewNotesColumn
                deal={deal}
                notes={overview.notes}
                onViewNote={() => onNavigateToSubTab("notes")}
            />
            <OverviewTasksColumn
                tasks={overview.tasks}
                rawTasks={tasks}
                taskBoardColumns={taskBoardColumns}
                openCount={overview.openTasksCount}
                onAddTask={onAddTask}
                onViewTask={() => onNavigateToSubTab("tasks")}
            />
            <OverviewMeetingsColumn
                meetings={overview.meetings}
                upcomingCount={overview.upcomingMeetingsCount}
                onAddMeeting={onAddMeeting}
                onViewMeeting={() => onNavigateToSubTab("meetings")}
            />
        </div>
    );
}
