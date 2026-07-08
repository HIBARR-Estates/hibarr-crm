import { useState } from "react";
import LogActionModal from "@/Components/CrmEvents/LogActionModal";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { DealTimelineDateRange } from "../../hooks/useDealTimeline";
import { TimelineFilter } from "../../adapters/timelineAdapter";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import { DealTimelineDateRangeControl } from "./DealTimelineDateRange";

const FILTERS: TimelineFilter[] = ["all", "agent", "system", "external"];

interface DealTimelineFiltersProps {
    dealId: number;
    userId?: number;
    filter: TimelineFilter;
    onFilterChange: (filter: TimelineFilter) => void;
    dateRange: DealTimelineDateRange | null;
    onDateRangeChange: (range: DealTimelineDateRange | null) => void;
    isRefetching: boolean;
    onRefresh: () => void;
}

export default function DealTimelineFilters({
    dealId,
    userId,
    filter,
    onFilterChange,
    dateRange,
    onDateRangeChange,
    isRefetching,
    onRefresh,
}: DealTimelineFiltersProps) {
    const { td } = useTd();
    const [logModalOpen, setLogModalOpen] = useState(false);

    return (
        <>
            <div
                style={{
                    display: "flex",
                    gap: 5,
                    marginBottom: 16,
                    alignItems: "center",
                    flexWrap: "wrap",
                }}
            >
                <span
                    style={{ fontSize: 12, color: T.TEXT_MUTED, marginRight: 4 }}
                >
                    Filter:
                </span>
                {FILTERS.map((currentFilter) => (
                    <button
                        key={currentFilter}
                        type="button"
                        onClick={() => onFilterChange(currentFilter)}
                        style={{
                            fontSize: 12,
                            padding: "4px 11px",
                            borderRadius: 20,
                            cursor: "pointer",
                            background: filter === currentFilter ? T.NAVY : T.WHITE,
                            color:
                                filter === currentFilter ? T.WHITE : T.TEXT_MUTED,
                            border: `1px solid ${filter === currentFilter ? T.NAVY : T.BORDER}`,
                            fontWeight: filter === currentFilter ? 500 : 400,
                            textTransform: "capitalize",
                        }}
                    >
                        {currentFilter}
                    </button>
                ))}

                <div
                    style={{
                        marginLeft: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <DealButton
                        variant="ghost"
                        icon={<DealIcon name="plus" size={12} />}
                        onClick={() => setLogModalOpen(true)}
                    >
                        {td("Log action")}
                    </DealButton>
                    <DealButton
                        variant="ghost"
                        icon={<DealIcon name="refresh" size={12} />}
                        onClick={onRefresh}
                        loading={isRefetching}
                    >
                        {td("Refresh")}
                    </DealButton>
                    <DealTimelineDateRangeControl
                        value={dateRange}
                        onChange={onDateRangeChange}
                    />
                </div>
            </div>

            <LogActionModal
                open={logModalOpen}
                onClose={() => setLogModalOpen(false)}
                onSuccess={onRefresh}
                modelType="App\\Models\\Deal"
                modelId={dealId}
                userId={userId}
            />
        </>
    );
}
