import { ReactNode } from "react";
import type { LeadTabCount, WorkspaceTabId } from "../../types";
import WorkspaceTabBar from "./WorkspaceTabBar";

interface WorkspaceCardProps {
    activeTab: WorkspaceTabId;
    onTabChange: (tab: WorkspaceTabId) => void;
    tabCounts?: LeadTabCount;
    children: ReactNode;
}

export default function WorkspaceCard({
    activeTab,
    onTabChange,
    tabCounts,
    children,
}: WorkspaceCardProps) {
    return (
        <section
            className="v2-workspace"
            style={{
                background: "#fff",
                border: "1px solid #e2e5ea",
                borderRadius: 12,
                overflow: "hidden",
            }}
        >
            <WorkspaceTabBar
                active={activeTab}
                onChange={onTabChange}
                counts={tabCounts}
            />
            <div style={{ padding: 16 }}>{children}</div>
        </section>
    );
}
