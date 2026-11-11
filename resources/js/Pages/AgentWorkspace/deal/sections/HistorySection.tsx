import { useMemo } from "react";
import { Dropdown, type MenuProps } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useEmailTimelineGroups from "@/Email/hooks/useEmailTimelineGroups";
import useIsAdminRole from "@/Hooks/useIsAdminRole";
import useTranslation from "@/Hooks/useTranslation";
import DealTimelineEventList from "@/Pages/Deals/Redesign/components/timeline/DealTimelineEventList";
import type { TimelineFilter } from "@/Pages/Deals/Redesign/adapters/timelineAdapter";
import type useDealTimeline from "@/Pages/Deals/Redesign/hooks/useDealTimeline";
import SectionCard from "./SectionCard";

const FILTERS: TimelineFilter[] = ["all", "agent", "system", "external"];

interface HistorySectionProps {
    dealId: number;
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
export default function HistorySection({ dealId, timeline, emailEnabled, onOpenEmailMessage }: HistorySectionProps) {
    const { t } = useTranslation();
    const canManage = useIsAdminRole();
    const { filter, setFilter, dateRange, events, isLoading, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = timeline;
    const {
        groups: emailGroups,
        loading: emailLoading,
    } = useEmailTimelineGroups({ recordType: "deal", recordId: dealId, enabled: emailEnabled });

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

    const items: MenuProps["items"] = FILTERS.map((value) => ({ key: value, label: t(`pages.deals.timeline.filter_${value}`) }));

    return (
        <SectionCard
            id="deal-history"
            title={t("pages.agent_workspace.deal.history.title")}
            className="agent-deal__section--history"
            action={
                <Dropdown
                    menu={{ items, selectedKeys: [filter], onClick: ({ key }) => setFilter(key as TimelineFilter) }}
                    trigger={["click"]}
                    placement="bottomRight"
                >
                    <span className="agent-contact__menu-anchor">
                        <Button size="sm" aria-haspopup="menu">
                            <Icon name="filter" size={12} />
                            {filter === "all" ? t("pages.agent_workspace.deal.history.filter") : t(`pages.deals.timeline.filter_${filter}`)}
                        </Button>
                    </span>
                </Dropdown>
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
