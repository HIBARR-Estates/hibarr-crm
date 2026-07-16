import { KeyboardEvent } from "react";
import { WorkspaceSubTab, WorkspaceSubTabCount } from "../../types";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useHScroll from "../../hooks/useHScroll";
import DealScrollArrow from "../primitives/DealScrollArrow";

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
    { id: "itinerary", label: "Itinerary", countKey: "itinerary" },
];

export default function WorkspaceSubTabBar({
    activeSubTab,
    counts,
    visibleTabs,
    onChange,
}: WorkspaceSubTabBarProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const scroll = useHScroll();
    const hasOverflow = scroll.overflow.left || scroll.overflow.right;

    const tabs = SUB_TABS.filter((tab) => visibleTabs.includes(tab.id));

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
        }
        event.preventDefault();
        const index = tabs.findIndex((tab) => tab.id === activeSubTab);
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        const nextTab = tabs[next];
        onChange(nextTab.id);
        document.getElementById(`workspace-subtab-${nextTab.id}`)?.focus();
    };

    return (
        <div className="flex items-center rounded-[10px] border border-[#e2e5ea] bg-[#f3f5f8] p-1">
            {hasOverflow && (
                <DealScrollArrow
                    dir="left"
                    enabled={scroll.overflow.left}
                    onClick={() => scroll.nudge(-1)}
                    label="Scroll tabs left"
                />
            )}
            <div
                ref={scroll.ref}
                onScroll={scroll.update}
                onKeyDown={handleKeyDown}
                role="tablist"
                aria-label="Workspace sections"
                className="dr-hscroll flex flex-1 items-center gap-1 overflow-x-auto"
            >
                {tabs.map((tab) => {
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
                        itinerary: t("pages.flight_itinerary.tab"),
                    };

                    return (
                        <button
                            key={tab.id}
                            id={`workspace-subtab-${tab.id}`}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            tabIndex={isActive ? 0 : -1}
                            className="inline-flex shrink-0 items-center gap-2 rounded-[8px] px-3 py-2 text-xs transition-all"
                            style={{
                                backgroundColor: isActive ? "#ffffff" : "transparent",
                                color: isActive ? "#1a1f2e" : "#667085",
                                fontWeight: isActive ? 600 : 500,
                                boxShadow: isActive ? "0 1px 2px rgba(16, 24, 40, 0.08)" : "none",
                            }}
                            onClick={() => onChange(tab.id)}
                        >
                            <span>{labelMap[tab.id]}</span>
                            {count != null && (
                                <span className="rounded-full bg-[#e9edf3] px-2 py-[1px] text-[11px] text-[#4b5563]">
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {hasOverflow && (
                <DealScrollArrow
                    dir="right"
                    enabled={scroll.overflow.right}
                    onClick={() => scroll.nudge(1)}
                    label="Scroll tabs right"
                />
            )}
        </div>
    );
}
