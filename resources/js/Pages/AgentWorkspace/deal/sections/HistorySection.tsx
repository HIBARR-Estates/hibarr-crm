import { useMemo } from "react";
import { AgentCardControls, AgentCardFilters } from "@/Components/Redesign/agent";
import useEmailTimelineGroups from "@/Email/hooks/useEmailTimelineGroups";
import useIsAdminRole from "@/Hooks/useIsAdminRole";
import useTranslation from "@/Hooks/useTranslation";
import DealTimelineEventList from "@/Pages/Deals/Redesign/components/timeline/DealTimelineEventList";
import type { TimelineFilter } from "@/Pages/Deals/Redesign/adapters/timelineAdapter";
import type useDealTimeline from "@/Pages/Deals/Redesign/hooks/useDealTimeline";
import SectionCard from "./SectionCard";

const FILTERS: TimelineFilter[] = ["all", "agent", "system", "external"];

interface HistorySectionProps {
    /** The deal, or the lead on the lead page (canvas L8-05). */
    recordId: number;
    recordType?: "deal" | "lead";
    timeline: ReturnType<typeof useDealTimeline>;
    emailEnabled: boolean;
    onOpenEmailMessage: (messageId: string) => void;
}

/**
 * Everything that happened on the deal, in time order: calls, emails, status
 * changes and what the system did. Filter narrows it to the agents', the
 * system's or outside parties'. The list is the deal page's own timeline,
 * so recordings, email conversations and an admin's edits all work here.
 */
export default function HistorySection({ recordId, recordType = "deal", timeline, emailEnabled, onOpenEmailMessage }: HistorySectionProps) {
    const { t } = useTranslation();
    const canManage = useIsAdminRole();
    const { filter, setFilter, dateRange, events, isLoading, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = timeline;
    const {
        groups: emailGroups,
        loading: emailLoading,
    } = useEmailTimelineGroups({ recordType, recordId, enabled: emailEnabled });

    // Email is its own projection; it joins only the unfiltered history.
    const filteredEmailGroups = useMemo(() => {
        if (filter !== "all" || !emailEnabled) return [];
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
        (isLoading && events.length === 0) || (emailEnabled && emailLoading && filteredEmailGroups.length === 0 && events.length === 0);


    return (
        <SectionCard
            id="deal-history"
            title={t("pages.agent_workspace.deal.history.title")}
            className="agent-deal__section--history"
            controls={
                <AgentCardControls>
                    <AgentCardFilters<TimelineFilter>
                        value={filter}
                        onChange={setFilter}
                        label={t("pages.agent_workspace.deal.history.filter")}
                        options={FILTERS.map((value) => ({ value, label: t(`pages.agent_workspace.deal.history.filter_${value}`) }))}
                    />
                </AgentCardControls>
            }
        >
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
        </SectionCard>
    );
}
