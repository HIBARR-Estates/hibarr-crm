import { useMemo } from "react";
import useIsAdminRole from "@/Hooks/useIsAdminRole";
import useEmailTimelineGroups from "@/Email/hooks/useEmailTimelineGroups";
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
     * Eloquent type for the session crm-events feed (fetch + Log Action).
     * Defaults to Deal; Leads pass LEAD_TIMELINE_MODEL_TYPE. Same value is
     * used for GET and POST so store/index stay aligned.
     */
    modelType?: string;
    /** lead | deal — drives the Email Timeline groups endpoint. */
    recordType?: "lead" | "deal";
    /**
     * Fail-closed Email gate (flag + pilot). When false, conversation
     * groups are not fetched.
     */
    emailEnabled?: boolean;
    /** Open the record email drawer focused on this message. */
    onOpenEmailMessage?: (messageId: string) => void;
}

export default function TimelineTab({
    dealId,
    userId,
    modelType = DEAL_TIMELINE_MODEL_TYPE,
    recordType = "deal",
    emailEnabled = false,
    onOpenEmailMessage,
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

    const {
        groups: emailGroups,
        loading: emailLoading,
        reload: reloadEmail,
    } = useEmailTimelineGroups({
        recordType,
        recordId: dealId,
        enabled: emailEnabled,
    });

    // LogActionModal / filters still take dealId naming — same numeric id.
    const entityId = dealId;

    const filteredEmailGroups = useMemo(() => {
        // Email is its own projection — only merge into the unfiltered Timeline.
        if (filter !== "all" || !emailEnabled) {
            return [];
        }

        return emailGroups.filter((group) => {
            if (!dateRange?.from && !dateRange?.to) return true;
            if (!group.latest_sent_at) return false;
            const day = group.latest_sent_at.slice(0, 10);
            if (dateRange.from && day < dateRange.from) return false;
            if (dateRange.to && day > dateRange.to) return false;
            return true;
        });
    }, [dateRange, emailEnabled, emailGroups, filter]);

    const listLoading =
        (isLoading && events.length === 0) ||
        (emailEnabled && emailLoading && filteredEmailGroups.length === 0 && events.length === 0);

    const handleRefresh = () => {
        refetch();
        if (emailEnabled) {
            void reloadEmail();
        }
    };

    return (
        <div className="w-full">
            <DealTimelineFilters
                dealId={entityId}
                userId={userId}
                filter={filter}
                onFilterChange={setFilter}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                isRefetching={isRefetching || (emailEnabled && emailLoading)}
                onRefresh={handleRefresh}
                modelType={modelType}
            />

            <DealTimelineEventList
                events={events}
                isLoading={listLoading}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
                canManage={canManage}
                onChanged={() => refetch()}
                emailGroups={filteredEmailGroups}
                onOpenEmailMessage={onOpenEmailMessage}
            />
        </div>
    );
}
