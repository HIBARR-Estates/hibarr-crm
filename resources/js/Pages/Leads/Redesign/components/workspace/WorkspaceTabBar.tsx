import type { WorkspaceTabId } from "../../types";
import { WORKSPACE_TABS } from "../../config/workspaceTabs";
import { formatTabLabel } from "../../adapters/tabCountAdapter";

interface WorkspaceTabBarProps {
    active: WorkspaceTabId;
    onChange: (tab: WorkspaceTabId) => void;
    counts?: Partial<Record<WorkspaceTabId, number>>;
}

export default function WorkspaceTabBar({
    active,
    onChange,
    counts = {},
}: WorkspaceTabBarProps) {
    return (
        <div className="v2-workspace-tabs">
            {WORKSPACE_TABS.map((tab) => {
                const count = counts[tab.id];
                const label = tab.countable
                    ? formatTabLabel(tab.label, count)
                    : tab.label;

                return (
                    <button
                        key={tab.id}
                        type="button"
                        className={`v2-tab${active === tab.id ? " active" : ""}`}
                        onClick={() => onChange(tab.id)}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
