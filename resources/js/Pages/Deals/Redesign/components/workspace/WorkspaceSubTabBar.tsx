import { WorkspaceSubTab, WorkspaceSubTabCount } from "../../types";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface WorkspaceSubTabBarProps {
    activeSubTab: WorkspaceSubTab;
    counts: WorkspaceSubTabCount;
    visibleTabs: WorkspaceSubTab[];
    onChange: (tab: WorkspaceSubTab) => void;
}

const SUB_TABS: Array<{ id: WorkspaceSubTab; label: string; countKey?: keyof WorkspaceSubTabCount }> = [
    { id: "overview", label: "Overview" },
    { id: "notes", label: "Notes", countKey: "notes" },
    { id: "tasks", label: "Tasks", countKey: "tasks" },
    { id: "meetings", label: "Meetings", countKey: "meetings" },
    { id: "files", label: "Files", countKey: "files" },
    { id: "offers", label: "Offers", countKey: "offers" },
    { id: "recommendations", label: "Recommendations", countKey: "recommendations" },
];

export default function WorkspaceSubTabBar({
    activeSubTab,
    counts,
    visibleTabs,
    onChange,
}: WorkspaceSubTabBarProps) {
    const { t } = useTranslation();
    const { td } = useTd();

    return (
        <div className="rounded-[10px] border border-[#e2e5ea] bg-[#f3f5f8] p-1">
            <div className="flex flex-wrap gap-1">
                {SUB_TABS.filter((tab) => visibleTabs.includes(tab.id)).map((tab) => {
                    const isActive = activeSubTab === tab.id;
                    const count = tab.countKey ? counts[tab.countKey] : null;
                    const labelMap: Record<WorkspaceSubTab, string> = {
                        overview: td("Overview"),
                        notes: t("pages.deals.tabs.notes"),
                        tasks: td("Tasks"),
                        meetings: t("pages.deals.tabs.meeting"),
                        files: t("pages.deals.tabs.files"),
                        offers: t("pages.deals.tabs.offers"),
                        recommendations: t("pages.deals.tabs.recommendations"),
                    };

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className="inline-flex items-center gap-2 rounded-[8px] px-3 py-2 text-xs transition-all"
                            style={{
                                backgroundColor: isActive ? "#ffffff" : "transparent",
                                color: isActive ? "#1a1f2e" : "#667085",
                                fontWeight: isActive ? 600 : 500,
                                boxShadow: isActive ? "0 1px 2px rgba(16, 24, 40, 0.08)" : "none",
                            }}
                            onClick={() => onChange(tab.id)}
                        >
                            <span>{labelMap[tab.id]}</span>
                            {count !== null && (
                                <span className="rounded-full bg-[#e9edf3] px-2 py-[1px] text-[11px] text-[#4b5563]">
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
