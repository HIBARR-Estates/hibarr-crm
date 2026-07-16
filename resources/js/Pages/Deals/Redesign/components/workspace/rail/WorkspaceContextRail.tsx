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
import { RailCardDeferredSkeleton } from "../overview/overviewShared";

interface WorkspaceContextRailProps {
    deal: Deal;
    /** undefined = deferred files still pending (C4) */
    files?: DealFile[];
    fields?: Array<{
        id: number;
        label?: string;
        name?: string;
        type?: string;
    }>;
    /** undefined = deferred tasks still pending */
    upcomingTasks?: WorkspaceTaskPreview[];
    /** undefined = deferred follow-ups still pending */
    upcomingMeetings?: WorkspaceMeetingPreview[];
    restrictPackageOrProperty?: boolean;
    onNavigateToSubTab: (tab: WorkspaceSubTab) => void;
    onSwitchToDealInfo: () => void;
    onManagePackagesProperties?: () => void;
    onAddTask: () => void;
    onAddMeeting: () => void;
}

export default function WorkspaceContextRail({
    deal,
    files,
    fields = [],
    upcomingTasks,
    upcomingMeetings,
    restrictPackageOrProperty = false,
    onNavigateToSubTab,
    onSwitchToDealInfo,
    onManagePackagesProperties,
    onAddTask,
    onAddMeeting,
}: WorkspaceContextRailProps) {
    const documents = useDealDocuments(deal, files ?? [], fields);
    const stageFocus = useDealStageFocus(deal, fields);

    return (
        <aside className="space-y-0">
            <WorkspaceLeadCard deal={deal} />
            {files === undefined ? (
                <RailCardDeferredSkeleton />
            ) : (
                <WorkspaceDocumentsCard
                    documents={documents.documents}
                    uploadedCount={documents.uploadedCount}
                    totalCount={documents.totalCount}
                    onOpenFiles={() => onNavigateToSubTab("files")}
                />
            )}
            <WorkspaceDealDetailsCard
                deal={deal}
                restrictPackageOrProperty={restrictPackageOrProperty}
                onManagePackagesProperties={
                    onManagePackagesProperties ?? onSwitchToDealInfo
                }
            />
            <WorkspaceStageFocusCard
                focus={stageFocus}
                onViewAll={onSwitchToDealInfo}
            />
            {upcomingTasks === undefined ? (
                <RailCardDeferredSkeleton />
            ) : (
                <WorkspaceUpcomingTasksCard
                    tasks={upcomingTasks}
                    onAddTask={onAddTask}
                    onOpenTasks={() => onNavigateToSubTab("tasks")}
                />
            )}
            {upcomingMeetings === undefined ? (
                <RailCardDeferredSkeleton />
            ) : (
                <WorkspaceMeetingsCard
                    meetings={upcomingMeetings}
                    onAddMeeting={onAddMeeting}
                    onOpenMeetings={() => onNavigateToSubTab("meetings")}
                />
            )}
        </aside>
    );
}
