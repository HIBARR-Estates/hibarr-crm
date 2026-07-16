import { KeyboardEvent } from "react";
import { DealMainTab } from "../../types";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface DealMainTabsProps {
    mainTab: DealMainTab;
    onChange: (tab: DealMainTab) => void;
}

const MAIN_TABS: Array<{ id: DealMainTab; label: string }> = [
    { id: "workspace", label: "Workspace" },
    { id: "dealinfo", label: "Deal information" },
    { id: "timeline", label: "Timeline" },
];

export default function DealMainTabs({ mainTab, onChange }: DealMainTabsProps) {
    const { td } = useTd();
    const labels: Record<DealMainTab, string> = {
        workspace: td("Workspace"),
        dealinfo: td("Deal information"),
        timeline: td("Timeline"),
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
        }
        event.preventDefault();
        const index = MAIN_TABS.findIndex((tab) => tab.id === mainTab);
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % MAIN_TABS.length;
        if (event.key === "ArrowLeft")
            next = (index - 1 + MAIN_TABS.length) % MAIN_TABS.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = MAIN_TABS.length - 1;
        const nextTab = MAIN_TABS[next];
        onChange(nextTab.id);
        document.getElementById(`deal-main-tab-${nextTab.id}`)?.focus();
    };

    return (
        <div className="dr-tabs">
            <div
                className="dr-tabs-scroll"
                role="tablist"
                aria-label="Deal sections"
                onKeyDown={handleKeyDown}
            >
                {MAIN_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        id={`deal-main-tab-${tab.id}`}
                        type="button"
                        role="tab"
                        aria-selected={mainTab === tab.id}
                        tabIndex={mainTab === tab.id ? 0 : -1}
                        className="dr-tab"
                        onClick={() => onChange(tab.id)}
                    >
                        {labels[tab.id]}
                    </button>
                ))}
            </div>
        </div>
    );
}
