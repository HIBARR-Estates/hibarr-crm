import { Deal } from "@/Types/api/deals";
import QuickActions from "./ActivitySidebar/QuickActions";
import CommunicationTimeline from "./ActivitySidebar/CommunicationTimeline";

interface Props {
    deal: Deal;
    activities: any[];
    permissions: Record<string, string>;
}

export default function ActivitySidebar({
    deal,
    activities,
    permissions,
}: Props) {
    return (
        <div className="flex flex-col gap-y-4">
            <QuickActions deal={deal} permissions={permissions} />
            <CommunicationTimeline activities={activities} deal={deal} />
        </div>
    );
}
