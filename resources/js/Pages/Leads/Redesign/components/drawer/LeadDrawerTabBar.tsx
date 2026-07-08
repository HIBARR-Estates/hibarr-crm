import type { LeadDrawerTab } from "../../types";
import LeadIcon from "../primitives/LeadIcon";

export interface DrawerTabConfig {
    id: LeadDrawerTab;
    label: string;
    icon: string;
    count?: number;
    hidden?: boolean;
}

interface LeadDrawerTabBarProps {
    tabs: DrawerTabConfig[];
    activeTab: LeadDrawerTab;
    onChange: (tab: LeadDrawerTab) => void;
}

export default function LeadDrawerTabBar({
    tabs,
    activeTab,
    onChange,
}: LeadDrawerTabBarProps) {
    const visibleTabs = tabs.filter((tab) => !tab.hidden);

    return (
        <div className="flex flex-wrap gap-1 border-b border-[#eef1f5] px-3 py-2">
            {visibleTabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    className={`drawer-tab${activeTab === tab.id ? " active" : ""}`}
                    onClick={() => onChange(tab.id)}
                >
                    <LeadIcon name={tab.icon} size={12} />
                    {tab.label}
                    {typeof tab.count === "number" && tab.count > 0 && (
                        <span className="rounded bg-white/80 px-1 text-[10px] font-semibold">
                            {tab.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}
