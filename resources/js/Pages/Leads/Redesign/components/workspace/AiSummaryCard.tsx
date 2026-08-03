import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import type { EntitySummaryPayload } from "@/Types/entity-summary";

interface AiSummaryCardProps {
    leadId: number;
    summary?: EntitySummaryPayload | null;
    leadPhone?: string;
    onCta?: {
        onQualifyLead?: () => void;
        onCreateTask?: () => void;
        onScheduleCall?: () => void;
    };
}

export default function AiSummaryCard({
    leadId,
    summary = null,
    leadPhone,
    onCta,
}: AiSummaryCardProps) {
    return (
        <EntityAiSummaryCard
            entityType="lead"
            entityId={leadId}
            initialSummary={summary}
            variant="redesign"
            className="mb-4"
            leadPhone={leadPhone}
            onQualifyLead={onCta?.onQualifyLead}
            onCreateTask={onCta?.onCreateTask}
            onScheduleCall={onCta?.onScheduleCall}
        />
    );
}
