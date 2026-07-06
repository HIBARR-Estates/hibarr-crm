import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";
import type { WorkspaceSubTab } from "../../../types";
import useDealDocuments from "../../../hooks/useDealDocuments";
import useDealStageFocus from "../../../hooks/useDealStageFocus";
import type { WorkspaceMeetingPreview } from "../../../adapters/meetingAdapter";
import type { WorkspaceTaskPreview } from "../../../adapters/taskAdapter";
import WorkspaceDealDetailsCard from "./WorkspaceDealDetailsCard";
import WorkspaceDocumentsCard from "./WorkspaceDocumentsCard";
import WorkspaceLeadCard from "./WorkspaceLeadCard";
import WorkspaceMeetingsCard from "./WorkspaceMeetingsCard";
import WorkspaceStageFocusCard from "./WorkspaceStageFocusCard";
import WorkspaceUpcomingTasksCard from "./WorkspaceUpcomingTasksCard";

interface WorkspaceContextRailProps {
    deal: Deal;
    files: DealFile[];
    fields?: Array<{
        id: number;
        label?: string;
        name?: string;
        type?: string;
    }>;
    upcomingTasks: WorkspaceTaskPreview[];
    upcomingMeetings: WorkspaceMeetingPreview[];
    onNavigateToSubTab: (tab: WorkspaceSubTab) => void;
    onSwitchToDealInfo: () => void;
    onAddTask: () => void;
    onAddMeeting: () => void;
}

export default function WorkspaceContextRail({
    deal,
    files,
    fields = [],
    upcomingTasks,
    upcomingMeetings,
    onNavigateToSubTab,
    onSwitchToDealInfo,
    onAddTask,
    onAddMeeting,
}: WorkspaceContextRailProps) {
    const documents = useDealDocuments(deal, files, fields);
    const stageFocus = useDealStageFocus(deal, fields);

    return (
        <aside className="space-y-0">
            <WorkspaceLeadCard deal={deal} />
            <WorkspaceDocumentsCard
                documents={documents.documents}
                uploadedCount={documents.uploadedCount}
                totalCount={documents.totalCount}
                onOpenFiles={() => onNavigateToSubTab("files")}
            />
            <WorkspaceDealDetailsCard deal={deal} />
            <WorkspaceStageFocusCard
                focus={stageFocus}
                onViewAll={onSwitchToDealInfo}
            />
            <WorkspaceUpcomingTasksCard
                tasks={upcomingTasks}
                onAddTask={onAddTask}
                onOpenTasks={() => onNavigateToSubTab("tasks")}
            />
            <WorkspaceMeetingsCard
                meetings={upcomingMeetings}
                onAddMeeting={onAddMeeting}
                onOpenMeetings={() => onNavigateToSubTab("meetings")}
            />
        </aside>
    );
}
