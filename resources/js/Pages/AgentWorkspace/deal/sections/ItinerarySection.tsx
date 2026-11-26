import { useMemo, useState } from "react";
import { Plane } from "lucide-react";
import { AgentCardControls, AgentCardFilters } from "@/Components/Redesign/agent";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import { toWorkspaceItineraryItem, type WorkspaceItineraryItem } from "@/Pages/Deals/Redesign/adapters/itineraryAdapter";
import DealItineraryModal from "@/Pages/Deals/Redesign/components/workspace/DealItineraryModal";
import type { Deal } from "@/Types/api/deals";
import { FlightDirection } from "@/Types/api/lead-flight-itinerary";
import ItineraryViewModal, { nightsOnIsland, orderLegs } from "../ItineraryViewModal";
import SectionCard, { SectionEmpty, SectionNoMatch } from "./SectionCard";

type LegFilter = "all" | FlightDirection;

export const LEG_STATUS_PILL: Record<string, string> = {
    "not arrived": "blue",
    arrived: "green",
    "not departed": "gray",
    departed: "gray",
};

/**
 * How the buyer is travelling (canvas L8-04): one row per flight with its
 * status and a View button that opens the whole trip. Its own card now;
 * exposés are a separate one.
 */
export default function ItinerarySection({ deal, canEdit }: { deal: Deal; canEdit: boolean }) {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<LegFilter>("all");
    const [viewing, setViewing] = useState<number | null>(null);
    const [adding, setAdding] = useState(false);

    const legs = useMemo(
        () => orderLegs((deal.lead_flight_itineraries ?? []).filter((leg) => leg.id != null).map(toWorkspaceItineraryItem)),
        [deal.lead_flight_itineraries],
    );
    const nights = nightsOnIsland(legs);
    const hasBoth = legs.some((leg) => leg.direction === FlightDirection.ARRIVAL) && legs.some((leg) => leg.direction === FlightDirection.DEPARTURE);
    const shown = legs.filter((leg) => filter === "all" || leg.direction === filter);
    const viewingLeg = legs.find((leg) => leg.id === viewing) ?? null;

    const sub = (leg: WorkspaceItineraryItem): string => {
        const parts = [leg.dateTimeLabel !== "—" ? leg.dateTimeLabel : ""];
        if (leg.isTransferRequired) parts.push(t("pages.agent_workspace.deal.itinerary.transfer_needed"));
        else if (leg.direction === FlightDirection.DEPARTURE && nights != null) {
            parts.push(t(nights === 1 ? "pages.agent_workspace.deal.itinerary.nights_one" : "pages.agent_workspace.deal.itinerary.nights_other", { count: nights }));
        }
        return parts.filter(Boolean).join(" · ");
    };

    return (
        <SectionCard
            id="deal-itinerary"
            title={
                <>
                    {t("pages.agent_workspace.deal.itinerary.card_title")}
                    {legs.length > 0 ? <span className="agent-card__count"> · {legs.length}</span> : null}
                </>
            }
            action={
                canEdit ? (
                    <Button size="sm" className="agent-btn-soft" onClick={() => setAdding(true)}>
                        <Icon name="plus" size={12} />
                        {t("pages.agent_workspace.deal.itinerary.add_flight")}
                    </Button>
                ) : null
            }
            controls={
                legs.length > 0 && (hasBoth || nights != null) ? (
                    <AgentCardControls
                        aside={
                            nights != null
                                ? t(nights === 1 ? "pages.agent_workspace.deal.itinerary.on_island_one" : "pages.agent_workspace.deal.itinerary.on_island_other", { count: nights })
                                : undefined
                        }
                    >
                        {hasBoth ? (
                            <AgentCardFilters<LegFilter>
                                value={filter}
                                onChange={setFilter}
                                label={t("pages.agent_workspace.contact.cards.filter_aria")}
                                options={[
                                    { value: "all", label: t("pages.agent_workspace.contact.cards.all") },
                                    { value: FlightDirection.ARRIVAL, label: t("pages.agent_workspace.deal.itinerary.arrivals") },
                                    { value: FlightDirection.DEPARTURE, label: t("pages.agent_workspace.deal.itinerary.departures") },
                                ]}
                            />
                        ) : null}
                    </AgentCardControls>
                ) : null
            }
        >
            {legs.length === 0 ? (
                <SectionEmpty>{t("pages.agent_workspace.deal.itinerary.empty_card")}</SectionEmpty>
            ) : shown.length === 0 ? (
                <SectionNoMatch />
            ) : (
                <ul className="agent-deal__rows">
                    {shown.map((leg) => (
                        <li key={leg.id} className="agent-deal__leg">
                            <span className={`agent-deal__leg-icon agent-deal__leg-icon--${leg.direction}`} aria-hidden="true">
                                <Plane size={16} />
                            </span>
                            <span className="agent-deal__row-body">
                                <span className="agent-deal__row-title">
                                    {[t(`pages.agent_workspace.deal.itinerary.${leg.direction}`), leg.flightNumberLabel !== "—" ? leg.flightNumberLabel : "", leg.airportLabel !== "—" ? leg.airportLabel : ""]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </span>
                                <span className="agent-deal__row-sub">{sub(leg)}</span>
                            </span>
                            <span className={`dr-pill dr-pill-${LEG_STATUS_PILL[leg.status] ?? "gray"}`}>{t(`pages.agent_workspace.deal.itinerary.status.${leg.status.replace(" ", "_")}`)}</span>
                            <Button size="sm" onClick={() => setViewing(leg.id)}>
                                {t("pages.agent_workspace.deal.itinerary.view")}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <ItineraryViewModal deal={deal} legs={legs} focus={viewingLeg} canEdit={canEdit} onClose={() => setViewing(null)} />
            <DealItineraryModal open={adding} onClose={() => setAdding(false)} dealId={deal.id} leg={null} />
        </SectionCard>
    );
}
