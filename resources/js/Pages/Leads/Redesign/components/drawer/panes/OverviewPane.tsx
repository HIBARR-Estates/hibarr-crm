import { useState } from "react";
import type { Lead } from "@/Types/api/leads";
import type { Task } from "@/Types/api/tasks";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { LeadDrawerTab } from "../../../types";
import type useLeadOverview from "../../../hooks/useLeadOverview";
import OverviewNotesColumn from "./overview/OverviewNotesColumn";
import OverviewTasksColumn from "./overview/OverviewTasksColumn";
import OverviewMeetingsColumn from "./overview/OverviewMeetingsColumn";
import LeadAddTaskModal from "./overview/LeadAddTaskModal";

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
    onScheduleMeeting?: () => void;
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
    onScheduleMeeting,
}: OverviewPaneProps) {
    const [addTaskOpen, setAddTaskOpen] = useState(false);

    return (
        <>
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
                    onAddTask={() => setAddTaskOpen(true)}
                    onViewTask={() => onNavigate("tasks")}
                />
                <OverviewMeetingsColumn
                    meetings={overview.meetings}
                    upcomingCount={overview.upcomingMeetingsCount}
                    canAdd={canAddMeeting && Boolean(onScheduleMeeting)}
                    onAddMeeting={() => onScheduleMeeting?.()}
                    onViewMeeting={() => onNavigate("meetings")}
                />
            </div>

            <LeadAddTaskModal
                open={addTaskOpen}
                onClose={() => setAddTaskOpen(false)}
                leadId={lead.id}
            />
        </>
    );
}
