import useIsAdminRole from "@/Hooks/useIsAdminRole";
import useDealTimeline, {
    DEAL_TIMELINE_MODEL_TYPE,
} from "../../hooks/useDealTimeline";
import DealTimelineEventList from "../timeline/DealTimelineEventList";
import DealTimelineFilters from "../timeline/DealTimelineFilters";

interface TimelineTabProps {
    /** Entity id (deal or lead). */
    dealId: number;
    dealName?: string;
    userId?: number;
    /**
     * Escaped Eloquent type for /api/v1/crm-events.
     * Defaults to Deal; Leads pass LEAD_TIMELINE_MODEL_TYPE.
     */
    modelType?: string;
}

export default function TimelineTab({
    dealId,
    userId,
    modelType = DEAL_TIMELINE_MODEL_TYPE,
}: TimelineTabProps) {
    // Editing/deleting agent-logged events is admin-only, mirroring the
    // backend gate in CrmEventController@update/@destroy (hasRole('admin')).
    const canManage = useIsAdminRole();

    const {
        filter,
        setFilter,
        dateRange,
        setDateRange,
        events,
        isLoading,
        isRefetching,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useDealTimeline(dealId, modelType);

    // LogActionModal / filters still take dealId naming — same numeric id.
    const entityId = dealId;

    return (
        <div className="w-full">
            <DealTimelineFilters
                dealId={entityId}
                userId={userId}
                filter={filter}
                onFilterChange={setFilter}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                isRefetching={isRefetching}
                onRefresh={() => refetch()}
                modelType={
                    modelType.includes("Lead")
                        ? "App\\Models\\Lead"
                        : "App\\Models\\Deal"
                }
            />

            <DealTimelineEventList
                events={events}
                isLoading={isLoading}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
                canManage={canManage}
                onChanged={() => refetch()}
            />
        </div>
    );
}
