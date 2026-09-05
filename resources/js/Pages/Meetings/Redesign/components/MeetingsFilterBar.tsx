import { useTd } from "@/Hooks/useDynamicTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import type { MeetingsTab } from "../adapters/meetingViewModel";

export type MeetingsTabCounts = Record<MeetingsTab, number>;

interface MeetingsFilterBarProps {
    /** Hidden on the calendar view, which shows every bucket at once. */
    showTabs: boolean;
    tab: MeetingsTab;
    onTabChange: (tab: MeetingsTab) => void;
    counts: MeetingsTabCounts;
    statsVisible: boolean;
    onToggleStats: () => void;
}

const TAB_LABELS: Array<{ value: MeetingsTab; label: string }> = [
    { value: "all", label: "All meetings" },
    { value: "upcoming", label: "Upcoming" },
    { value: "live", label: "Live" },
    { value: "past", label: "Past" },
];

export default function MeetingsFilterBar({
    showTabs,
    tab,
    onTabChange,
    counts,
    statsVisible,
    onToggleStats,
}: MeetingsFilterBarProps) {
    const { td } = useTd();

    return (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            {showTabs && (
                <Segmented<MeetingsTab>
                    value={tab}
                    onChange={onTabChange}
                    ariaLabel={td("Filter meetings")}
                    options={TAB_LABELS.map((option) => ({
                        value: option.value,
                        label: td(option.label),
                        count: counts[option.value],
                    }))}
                />
            )}

            <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={onToggleStats}
                aria-pressed={statsVisible}
                icon={
                    <Icon name={statsVisible ? "eye-off" : "eye"} size={14} />
                }
            >
                {statsVisible ? td("Hide stats") : td("Show stats")}
            </Button>
        </div>
    );
}
