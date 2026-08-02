import { ReactNode } from "react";
import type { WorkspaceTabId } from "../../types";
import WorkspaceTabBar from "./WorkspaceTabBar";

interface WorkspaceCardProps {
    activeTab: WorkspaceTabId;
    onTabChange: (tab: WorkspaceTabId) => void;
    tabCounts?: Partial<Record<WorkspaceTabId, number>>;
    children: ReactNode;
}

export default function WorkspaceCard({
    activeTab,
    onTabChange,
    tabCounts,
    children,
}: WorkspaceCardProps) {
    return (
        <div className="v2-workspace">
            <WorkspaceTabBar
                active={activeTab}
                onChange={onTabChange}
                counts={tabCounts}
            />
            <div className="v2-workspace-body">{children}</div>
        </div>
    );
}
