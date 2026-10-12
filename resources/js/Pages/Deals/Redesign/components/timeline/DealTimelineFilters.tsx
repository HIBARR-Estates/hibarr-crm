import { useState } from "react";
import LogActionModal from "@/Components/CrmEvents/LogActionModal";
import useTranslation from "@/Hooks/useTranslation";
import type { DealTimelineDateRange } from "../../hooks/useDealTimeline";
import { TimelineFilter } from "../../adapters/timelineAdapter";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { DealTimelineDateRangeControl } from "./DealTimelineDateRange";

const FILTERS: TimelineFilter[] = ["all", "agent", "system", "external"];
const FILTER_LABEL_KEYS: Record<TimelineFilter, string> = {
    all: "filter_all",
    agent: "filter_agent",
    system: "filter_system",
    external: "filter_external",
};

interface DealTimelineFiltersProps {
    dealId: number;
    userId?: number;
    filter: TimelineFilter;
    onFilterChange: (filter: TimelineFilter) => void;
    dateRange: DealTimelineDateRange | null;
    onDateRangeChange: (range: DealTimelineDateRange | null) => void;
    isRefetching: boolean;
    onRefresh: () => void;
    /**
     * Eloquent model type for LogActionModal. Prefer the same escaped form
     * used by useDealTimeline (App\\\\Models\\\\Deal) so GET and POST agree.
     */
    modelType?: string;
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
    modelType = "App\\\\Models\\\\Deal",
}: DealTimelineFiltersProps) {
    const { t } = useTranslation();
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
                    {t("pages.deals.timeline.filter_label")}:
                </span>
                {FILTERS.map((currentFilter) => (
                    <button
                        key={currentFilter}
                        type="button"
                        className="dr-filter"
                        aria-pressed={filter === currentFilter}
                        onClick={() => onFilterChange(currentFilter)}
                    >
                        {t(
                            `pages.deals.timeline.${FILTER_LABEL_KEYS[currentFilter]}`,
                        )}
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
                    <Button
                        variant="ghost"
                        icon={<Icon name="plus" size={12} />}
                        onClick={() => setLogModalOpen(true)}
                    >
                        {t("pages.deals.timeline.log_action")}
                    </Button>
                    <Button
                        variant="ghost"
                        icon={<Icon name="refresh" size={12} />}
                        onClick={onRefresh}
                        loading={isRefetching}
                    >
                        {t("pages.deals.common.refresh")}
                    </Button>
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
                modelType={modelType}
                modelId={dealId}
                userId={userId}
            />
        </>
    );
}
