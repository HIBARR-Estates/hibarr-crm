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

    return (
        <div className="flex border-b border-[#e2e5ea] bg-white px-[26px]">
            {MAIN_TABS.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    className="mtab border-b-2 px-[18px] py-[11px] text-sm"
                    style={{
                        color: mainTab === tab.id ? "#1a6bb5" : "#6b7280",
                        borderBottomColor: mainTab === tab.id ? "#1a6bb5" : "transparent",
                        fontWeight: mainTab === tab.id ? 500 : 400,
                    }}
                    onClick={() => onChange(tab.id)}
                >
                    {labels[tab.id]}
                </button>
            ))}
        </div>
    );
}
