import { ReactNode } from "react";
import type { LeadTabCount, WorkspaceTabId } from "../../types";
import WorkspaceTabBar from "./WorkspaceTabBar";

interface WorkspaceCardProps {
    activeTab: WorkspaceTabId;
    onTabChange: (tab: WorkspaceTabId) => void;
    tabCounts?: LeadTabCount;
    showQualification?: boolean;
    showExposes?: boolean;
    children: ReactNode;
}

export default function WorkspaceCard({
    activeTab,
    onTabChange,
    tabCounts,
    showQualification = true,
    showExposes = false,
    children,
}: WorkspaceCardProps) {
    return (
        <section
            className="v2-workspace dr-workspace-card"
            style={{
                background: "#fff",
                border: "1px solid var(--dr-border)",
                borderRadius: 12,
                overflow: "hidden",
            }}
        >
            <WorkspaceTabBar
                active={activeTab}
                onChange={onTabChange}
                counts={tabCounts}
                showQualification={showQualification}
                showExposes={showExposes}
            />
            <div className="dr-workspace-tab-body" style={{ padding: 16 }}>
                {children}
            </div>
        </section>
    );
}
