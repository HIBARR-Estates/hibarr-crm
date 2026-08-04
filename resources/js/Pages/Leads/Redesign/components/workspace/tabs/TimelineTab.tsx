import DealTimelineTab from "@/Pages/Deals/Redesign/components/tabs/TimelineTab";
import { LEAD_TIMELINE_MODEL_TYPE } from "@/Pages/Deals/Redesign/hooks/useDealTimeline";

interface TimelineTabProps {
    leadId: number;
    leadName?: string;
    userId?: number;
}

export default function TimelineTab({
    leadId,
    leadName,
    userId,
}: TimelineTabProps) {
    return (
        <DealTimelineTab
            dealId={leadId}
            dealName={leadName}
            userId={userId}
            modelType={LEAD_TIMELINE_MODEL_TYPE}
        />
    );
}
