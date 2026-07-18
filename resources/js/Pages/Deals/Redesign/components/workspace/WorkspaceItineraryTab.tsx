import { useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import type { Deal } from "@/Types/api/deals";
import { FlightDirection } from "@/Types/api/lead-flight-itinerary";
import { toWorkspaceItineraryItem } from "../../adapters/itineraryAdapter";
import useDealItinerary from "../../hooks/useDealItinerary";
import DealAddItineraryModal from "./DealAddItineraryModal";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

type ItineraryFilter = "all" | "arrival" | "departure" | "transfer";

interface WorkspaceItineraryTabProps {
    deal: Deal;
    canAdd: boolean;
    canDelete: boolean;
}

/** Ported from v2.2's ItineraryTab (deal-v2-2.jsx:2953-3086), backed by the
 * real lead-flight-itineraries routes (see legacy LeadFlightItineraryTab).
 * Scoped to what v2.2 actually shows — add + delete, no roundtrip/edit/image
 * upload, which the legacy tab supports but v2.2's design doesn't surface. */
export default function WorkspaceItineraryTab({
    deal,
    canAdd,
    canDelete,
}: WorkspaceItineraryTabProps) {
    const { t } = useTranslation();
    const ft = (key: string) => t(`pages.flight_itinerary.${key}`);
    const [filter, setFilter] = useState<ItineraryFilter>("all");
    const [addOpen, setAddOpen] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const { deleteLeg, deletingId } = useDealItinerary(deal.id);

    const items = useMemo(
        () => (deal.lead_flight_itineraries ?? []).map(toWorkspaceItineraryItem),
        [deal.lead_flight_itineraries],
    );

    const filtered = items.filter((leg) => {
        if (filter === "arrival") return leg.direction === FlightDirection.ARRIVAL;
        if (filter === "departure") return leg.direction === FlightDirection.DEPARTURE;
        if (filter === "transfer") return leg.isTransferRequired;
        return true;
    });

    const filterOptions: Array<{ id: ItineraryFilter; label: string }> = [
        { id: "all", label: ft("filter_all") },
        { id: "arrival", label: ft("filter_arrivals") },
        { id: "departure", label: ft("filter_departures") },
        { id: "transfer", label: ft("filter_transfer_needed") },
    ];

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap gap-1" role="group" aria-label="Filter flights">
                    {filterOptions.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className="dr-filter"
                            aria-pressed={filter === option.id}
                            onClick={() => setFilter(option.id)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {canAdd && (
                    <DealButton
                        variant="primary"
                        size="sm"
                        onClick={() => setAddOpen(true)}
                    >
                        + {ft("add_flight")}
                    </DealButton>
                )}
            </div>

            {filtered.length === 0 ? (
                <div
                    role="status"
                    className="rounded-[10px] border border-dashed px-3.5 py-6 text-center"
                    style={{ borderColor: T.BORDER, background: T.SURFACE_2 }}
                >
                    <div className="mb-[3px] text-[13px] font-semibold text-[#1a1f2e]">
                        {ft("empty")}
                    </div>
                    <div className="text-xs text-[#5b6472]">
                        {t("Track the client's inspection-trip flights and airport transfers here.")}
                    </div>
                </div>
            ) : (
                filtered.map((leg) => {
                    const isArrival = leg.direction === FlightDirection.ARRIVAL;
                    return (
                        <div key={leg.id} className="dr-card flex items-center gap-3">
                            <div
                                aria-hidden="true"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                                style={{
                                    background: isArrival ? T.GREEN_LIGHT : T.BLUE_LIGHT,
                                    borderColor: isArrival ? T.GREEN_MID : T.BLUE_MID,
                                    color: isArrival ? T.GREEN : "#14538c",
                                    transform: isArrival
                                        ? "rotate(45deg)"
                                        : "rotate(-45deg)",
                                }}
                            >
                                <DealIcon name="external-link" size={15} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="mb-[3px] flex flex-wrap items-center gap-2">
                                    <span className="text-[13px] font-semibold">
                                        {leg.flightNumberLabel}
                                    </span>
                                    <span
                                        className={`dr-pill dr-pill-${isArrival ? "green" : "blue"}`}
                                    >
                                        {isArrival ? ft("arrival") : ft("departure")}
                                    </span>
                                    <span className={`dr-pill dr-pill-${leg.statusTone}`}>
                                        {ft(`status_${leg.status.replace(/ /g, "_")}`)}
                                    </span>
                                    {leg.isTransferRequired && (
                                        <span className="dr-pill dr-pill-amber">
                                            {ft("transfer_required")}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-[#5b6472]">
                                    {leg.airportLabel} · {leg.dateTimeLabel}
                                </div>
                            </div>
                            {canDelete && (
                                <button
                                    type="button"
                                    className="dr-btn dr-btn-sm"
                                    style={{
                                        color: T.RED,
                                        background: "transparent",
                                        border: "none",
                                    }}
                                    disabled={deletingId === leg.id}
                                    onClick={() => setConfirmDeleteId(leg.id)}
                                >
                                    {t("app.delete")}
                                </button>
                            )}
                        </div>
                    );
                })
            )}

            <DealAddItineraryModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                dealId={deal.id}
            />

            <DealConfirmDialog
                open={confirmDeleteId != null}
                title={ft("delete_flight")}
                message={ft("delete_confirm")}
                confirmLabel={ft("delete_flight")}
                danger
                confirmLoading={confirmDeleteId != null && deletingId === confirmDeleteId}
                onConfirm={() => {
                    if (confirmDeleteId != null) {
                        deleteLeg(confirmDeleteId, () => setConfirmDeleteId(null));
                    }
                }}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    );
}
