import { Deal } from "@/Types/api/deals";
import CommunicationTimeline from "./ActivitySidebar/CommunicationTimeline";

interface Props {
    deal: Deal;
    permissions: Record<string, string>;
}

export default function ActivitySidebar({ deal, permissions }: Props) {
    return (
        <div className="flex flex-col gap-y-4">
            <CommunicationTimeline deal={deal} />
        </div>
    );
}
