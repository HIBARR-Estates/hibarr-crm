import { FlightDirection, ILeadFlightItinerary } from "@/Types/api/lead-flight-itinerary";
import { parseNaiveDateTime } from "@/lib/companyDateTime";
import {
    formatDate,
    formatMonthShort,
    formatTime,
} from "./dateFormat";

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
    dateLabel: string;
    timeLabel: string;
    monthLabel: string;
    dayLabel: string;
    /** Kept for filters / secondary display. */
    dateTimeLabel: string;
    startsAt: Date | null;
    isUpcoming: boolean;
    isPast: boolean;
    status: string;
    statusTone: ItineraryStatusTone;
    isTransferRequired: boolean;
    raw: ILeadFlightItinerary;
}

export function toWorkspaceItineraryItem(
    leg: ILeadFlightItinerary,
): WorkspaceItineraryItem {
    const valid = parseNaiveDateTime(leg.flight_date);
    const startsAtMs = valid?.getTime() ?? null;

    return {
        id: leg.id as number,
        direction: leg.direction,
        flightNumberLabel: leg.flight_number || "—",
        airportLabel: leg.airport_name || "—",
        dateLabel: formatDate(valid, "—"),
        timeLabel: formatTime(valid, "—"),
        monthLabel: formatMonthShort(valid, "—"),
        dayLabel: valid ? String(valid.getDate()) : "—",
        dateTimeLabel: valid
            ? `${formatDate(valid)} · ${formatTime(valid)}`
            : "—",
        startsAt: valid,
        isUpcoming: startsAtMs != null ? startsAtMs >= Date.now() : false,
        isPast: startsAtMs != null ? startsAtMs < Date.now() : false,
        status: leg.status,
        statusTone: ITINERARY_STATUS_TONE[leg.status] ?? "gray",
        isTransferRequired: Boolean(leg.is_transfer_required),
        raw: leg,
    };
}

/** Upcoming soonest-first; past most-recent-first. Dateless legs sink to the end. */
export function sortItineraryItems(
    items: WorkspaceItineraryItem[],
    section: "upcoming" | "past",
): WorkspaceItineraryItem[] {
    return [...items].sort((a, b) => {
        const aTime = a.startsAt?.getTime() ?? null;
        const bTime = b.startsAt?.getTime() ?? null;
        if (aTime == null && bTime == null) return 0;
        if (aTime == null) return 1;
        if (bTime == null) return -1;
        return section === "upcoming" ? aTime - bTime : bTime - aTime;
    });
}
