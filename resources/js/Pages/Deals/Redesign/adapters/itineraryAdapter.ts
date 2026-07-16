import { FlightDirection, ILeadFlightItinerary } from "@/Types/api/lead-flight-itinerary";

export type ItineraryStatusTone = "amber" | "green" | "gray";

export const ITINERARY_STATUS_TONE: Record<string, ItineraryStatusTone> = {
    "not arrived": "amber",
    arrived: "green",
    "not departed": "amber",
    departed: "gray",
};

export interface WorkspaceItineraryItem {
    id: number;
    direction: FlightDirection;
    flightNumberLabel: string;
    airportLabel: string;
    dateTimeLabel: string;
    status: string;
    statusTone: ItineraryStatusTone;
    isTransferRequired: boolean;
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

export function toWorkspaceItineraryItem(
    leg: ILeadFlightItinerary,
): WorkspaceItineraryItem {
    const parsed = leg.flight_date ? new Date(leg.flight_date) : null;
    return {
        id: leg.id as number,
        direction: leg.direction,
        flightNumberLabel: leg.flight_number || "—",
        airportLabel: leg.airport_name || "—",
        dateTimeLabel:
            parsed && !Number.isNaN(parsed.getTime())
                ? DATE_TIME_FORMAT.format(parsed)
                : "—",
        status: leg.status,
        statusTone: ITINERARY_STATUS_TONE[leg.status] ?? "gray",
        isTransferRequired: Boolean(leg.is_transfer_required),
    };
}
