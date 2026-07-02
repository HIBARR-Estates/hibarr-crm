import { CrmEventTimeline } from "@/Components/CrmEvents";

interface TimelineTabProps {
    dealId: number;
    dealName?: string;
    userId?: number;
}

export default function TimelineTab({ dealId, dealName, userId }: TimelineTabProps) {
    return (
        <div className="mx-auto w-full max-w-[680px]">
            <CrmEventTimeline
                modelType="App\\Models\\Deal"
                modelId={dealId}
                userId={userId}
                compact={false}
                entityName={dealName}
                variant="deal-redesign"
            />
        </div>
    );
}
