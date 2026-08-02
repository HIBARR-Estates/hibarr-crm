import { useMemo } from "react";
import LeadFlightItineraryTab from "@/Components/LeadFlightItineraryTab";
import type { ILeadFlightItinerary } from "@/Types/api/lead-flight-itinerary";
import type { Deal } from "@/Types/api/deals";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";

interface ItineraryTabProps {
    permissions?: {
        canAdd?: boolean;
        canEdit?: boolean;
        canDelete?: boolean;
    };
}

export default function ItineraryTab({ permissions }: ItineraryTabProps) {
    const { deals } = useLeadWorkspace();

    const itineraryLegs = useMemo(() => {
        const legs: ILeadFlightItinerary[] = [];
        deals.forEach((deal: Deal) => {
            (deal.lead_flight_itineraries ?? []).forEach((leg) => {
                legs.push(leg);
            });
        });
        return legs;
    }, [deals]);

    const primaryDealId = deals[0]?.id;

    return (
        <LeadFlightItineraryTab
            itineraryLegs={itineraryLegs}
            dealId={primaryDealId}
            permissions={{
                canAdd: permissions?.canAdd ?? false,
                canEdit: permissions?.canEdit ?? false,
                canDelete: permissions?.canDelete ?? false,
            }}
        />
    );
}
