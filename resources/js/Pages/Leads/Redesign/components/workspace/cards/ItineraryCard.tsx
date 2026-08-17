import type { ILeadFlightItinerary } from "@/Types/api/lead-flight-itinerary";
import { formatCompanyDateTime, parseNaiveDateTime } from "@/lib/companyDateTime";

interface ItineraryCardProps {
    leg: ILeadFlightItinerary;
    onClick?: () => void;
}

export default function ItineraryCard({ leg, onClick }: ItineraryCardProps) {
    const parsed = parseNaiveDateTime(leg.flight_date);
    const when = parsed ? formatCompanyDateTime(parsed) : "—";

    return (
        <button
            type="button"
            className="v2-itinerary-card mb-2 w-full cursor-pointer text-left"
            onClick={onClick}
        >
            <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold capitalize text-[#1a1f2e]">
                    {leg.direction} · {leg.flight_number || "—"}
                </span>
                <span className="v2-pill v2-pill-gray">{leg.status}</span>
            </div>
            <div className="text-xs text-[#6b7280]">{leg.airport_name}</div>
            <div className="mt-0.5 text-[11px] text-[#9ca3af]">{when}</div>
        </button>
    );
}
