import { useMemo, useState } from "react";
import { Car, Plane } from "lucide-react";
import { AgentDialog, AgentDialogSection, AgentNewTag } from "@/Components/Redesign/agent";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { formatDate } from "@/Pages/Deals/Redesign/adapters/dateFormat";
import { type WorkspaceItineraryItem } from "@/Pages/Deals/Redesign/adapters/itineraryAdapter";
import { toWorkspaceMeetingPreview } from "@/Pages/Deals/Redesign/adapters/meetingAdapter";
import DealItineraryModal from "@/Pages/Deals/Redesign/components/workspace/DealItineraryModal";
import { useDealWorkspace } from "@/Pages/Deals/Redesign/context/DealWorkspaceContext";
import useDealItinerary from "@/Pages/Deals/Redesign/hooks/useDealItinerary";
import type { Deal } from "@/Types/api/deals";
import { FlightDirection } from "@/Types/api/lead-flight-itinerary";
import { LEG_STATUS_PILL } from "./sections/ItinerarySection";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Arrivals first, then departures; each soonest first, dateless last. */
export function orderLegs(legs: WorkspaceItineraryItem[]): WorkspaceItineraryItem[] {
    const time = (leg: WorkspaceItineraryItem) => leg.startsAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return [...legs].sort((a, b) => {
        if (a.direction !== b.direction) return a.direction === FlightDirection.ARRIVAL ? -1 : 1;
        return time(a) - time(b);
    });
}

/** Calendar nights between the first arrival and the last departure, when both are dated. */
export function nightsOnIsland(legs: WorkspaceItineraryItem[]): number | null {
    const arrivals = legs.filter((leg) => leg.direction === FlightDirection.ARRIVAL && leg.startsAt);
    const departures = legs.filter((leg) => leg.direction === FlightDirection.DEPARTURE && leg.startsAt);
    if (arrivals.length === 0 || departures.length === 0) return null;
    const start = new Date(Math.min(...arrivals.map((leg) => leg.startsAt!.getTime())));
    const end = new Date(Math.max(...departures.map((leg) => leg.startsAt!.getTime())));
    const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    const nights = Math.round((endDay - startDay) / DAY_MS);
    return nights >= 0 ? nights : null;
}

/** The status a leg moves to next, when it can still move. */
function nextStatus(leg: WorkspaceItineraryItem): string | null {
    if (leg.status === "not arrived") return "arrived";
    if (leg.status === "not departed") return "departed";
    return null;
}

interface ItineraryViewModalProps {
    deal: Deal;
    /** Every leg of the deal, already ordered. */
    legs: WorkspaceItineraryItem[];
    /** The leg whose View was pressed; null keeps the dialog closed. */
    focus: WorkspaceItineraryItem | null;
    canEdit: boolean;
    onClose: () => void;
}

/**
 * The whole trip in one dialog (canvas L8-07): each flight with its status and
 * transfer, the deal's meetings during the stay, and the ticket images. Edit
 * and delete act on the flight that was opened; marking arrived or departed
 * moves the next flight on. Booking a transfer has no CRM backing yet, so it is
 * held and marked New.
 */
export default function ItineraryViewModal({ deal, legs, focus, canEdit, onClose }: ItineraryViewModalProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { dealFollowUps } = useDealWorkspace();
    const { updateLeg, isUpdating, deleteLeg, deletingId } = useDealItinerary(deal.id);
    const [editing, setEditing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const nights = nightsOnIsland(legs);
    const dated = legs.filter((leg) => leg.startsAt);
    const first = dated.length ? new Date(Math.min(...dated.map((leg) => leg.startsAt!.getTime()))) : null;
    const last = dated.length ? new Date(Math.max(...dated.map((leg) => leg.startsAt!.getTime()))) : null;

    const stay = useMemo(() => {
        if (!first) return [];
        const from = first.getTime();
        const to = last && last.getTime() > from ? last.getTime() : from + 14 * DAY_MS;
        return dealFollowUps
            .map(toWorkspaceMeetingPreview)
            .filter((meeting) => meeting.startsAt && meeting.startsAt.getTime() >= from && meeting.startsAt.getTime() <= to)
            .sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime());
    }, [dealFollowUps, first?.getTime(), last?.getTime()]);

    const tickets = legs.filter((leg) => leg.raw.ticket_image_url);
    const pending = legs.find((leg) => nextStatus(leg) !== null) ?? null;
    const transferLeg = legs.find((leg) => leg.isTransferRequired && !leg.isPast) ?? null;
    const clientName = deal.contact?.client_name || deal.name;

    const dateRange =
        first && last && last.getTime() !== first.getTime() ? `${formatDate(first)} – ${formatDate(last)}` : first ? formatDate(first) : "";
    const subtitle = [
        dateRange,
        nights != null
            ? t(nights === 1 ? "pages.agent_workspace.deal.itinerary.on_island_one" : "pages.agent_workspace.deal.itinerary.on_island_other", { count: nights })
            : "",
        t(legs.length === 1 ? "pages.agent_workspace.deal.itinerary.flights_one" : "pages.agent_workspace.deal.itinerary.flights_other", { count: legs.length }),
    ]
        .filter(Boolean)
        .join(" · ");

    const markNext = () => {
        if (!pending) return;
        const status = nextStatus(pending);
        if (!status) return;
        const raw = pending.raw;
        // updateLeg keeps the leg's own status when the direction is unchanged,
        // so hand it the leg as it should end up.
        updateLeg(
            { ...raw, status },
            {
                direction: raw.direction,
                flight_number: raw.flight_number ?? "",
                airport_name: raw.airport_name ?? "",
                flight_date: raw.flight_date ?? "",
                is_transfer_required: Boolean(raw.is_transfer_required),
                ticket_image_url: raw.ticket_image_url ?? null,
            },
        );
    };

    const open = focus !== null && !editing;

    return (
        <>
            <AgentDialog
                open={open}
                onClose={onClose}
                closeLabel={t("pages.agent_workspace.deal.itinerary.close")}
                title={t("pages.agent_workspace.deal.itinerary.trip_title", { name: clientName })}
                subtitle={subtitle}
                headerAside={
                    canEdit && focus ? (
                        <Button size="sm" onClick={() => setEditing(true)}>
                            <Icon name="edit" size={13} />
                            {t("pages.agent_workspace.deal.itinerary.edit_flight")}
                        </Button>
                    ) : null
                }
                footer={
                    <>
                        {canEdit && focus ? (
                            <Button size="sm" variant="ghost" className="agent-dlg__danger" onClick={() => setConfirmDelete(true)} disabled={deletingId !== null}>
                                <Icon name="trash" size={13} />
                                {t("pages.agent_workspace.deal.itinerary.delete_flight")}
                            </Button>
                        ) : null}
                        <span className="agent-dlg__spacer" />
                        {canEdit && pending ? (
                            <Button size="sm" onClick={markNext} disabled={isUpdating}>
                                {t(
                                    pending.direction === FlightDirection.ARRIVAL
                                        ? "pages.agent_workspace.deal.itinerary.mark_arrived"
                                        : "pages.agent_workspace.deal.itinerary.mark_departed",
                                )}
                            </Button>
                        ) : null}
                        <Button size="sm" variant="navy" disabled>
                            <Car size={13} />
                            {t("pages.agent_workspace.deal.itinerary.book_transfer")}
                            <AgentNewTag hint={t("pages.agent_workspace.deal.itinerary.book_transfer_held")} />
                        </Button>
                    </>
                }
            >
                <div className="agent-trip__legs">
                    {legs.map((leg) => (
                        <article key={leg.id} className={`agent-trip__leg${focus?.id === leg.id ? " is-focus" : ""}`}>
                            <div className="agent-trip__leg-head">
                                <span className={`agent-deal__leg-icon agent-deal__leg-icon--${leg.direction}`} aria-hidden="true">
                                    <Plane size={17} />
                                </span>
                                <span className="agent-trip__leg-titles">
                                    <span className="agent-dlg__cap">{t(`pages.agent_workspace.deal.itinerary.${leg.direction}`)}</span>
                                    <b>{leg.flightNumberLabel !== "—" ? leg.flightNumberLabel : t("pages.agent_workspace.deal.itinerary.no_flight_number")}</b>
                                </span>
                                <span className={`dr-pill dr-pill-${LEG_STATUS_PILL[leg.status] ?? "gray"}`}>
                                    {t(`pages.agent_workspace.deal.itinerary.status.${leg.status.replace(" ", "_")}`)}
                                </span>
                            </div>
                            <div className="agent-trip__airport">
                                <b>{leg.airportLabel}</b>
                            </div>
                            <dl className="agent-trip__facts">
                                <div>
                                    <dt>{t("pages.agent_workspace.deal.itinerary.when")}</dt>
                                    <dd>{leg.dateTimeLabel}</dd>
                                </div>
                                <div>
                                    <dt>{t("pages.agent_workspace.deal.itinerary.transfer")}</dt>
                                    <dd className="agent-trip__transfer">
                                        {leg.isTransferRequired ? <Car size={14} aria-hidden="true" /> : null}
                                        {t(leg.isTransferRequired ? "pages.agent_workspace.deal.itinerary.transfer_required" : "pages.agent_workspace.deal.itinerary.transfer_not_required")}
                                    </dd>
                                </div>
                            </dl>
                        </article>
                    ))}
                </div>
                <div className="agent-trip__lower">
                    <AgentDialogSection title={t("pages.agent_workspace.deal.itinerary.during_stay")}>
                        {stay.length === 0 ? (
                            <p className="agent-trip__empty">{t("pages.agent_workspace.deal.itinerary.no_meetings")}</p>
                        ) : (
                            <ul className="agent-trip__stay">
                                {stay.map((meeting) => (
                                    <li key={meeting.id}>
                                        <span className="agent-trip__day">{formatDate(meeting.startsAt)}</span>
                                        <span className="agent-trip__stay-body">
                                            <span className="agent-trip__stay-title">{td(meeting.title, { source: "en" })}</span>
                                            <span className="agent-trip__stay-sub">{[meeting.timeLabel, meeting.location].filter(Boolean).join(" · ")}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </AgentDialogSection>
                    <AgentDialogSection title={t("pages.agent_workspace.deal.itinerary.tickets")}>
                        {tickets.length === 0 ? (
                            <p className="agent-trip__empty">{t("pages.agent_workspace.deal.itinerary.no_tickets")}</p>
                        ) : (
                            <div className="agent-trip__tickets">
                                {tickets.map((leg) => (
                                    <a key={leg.id} className="agent-trip__ticket" href={leg.raw.ticket_image_url ?? undefined} target="_blank" rel="noreferrer">
                                        <img src={leg.raw.ticket_image_url ?? undefined} alt="" loading="lazy" />
                                        <span>
                                            {t("pages.agent_workspace.deal.itinerary.ticket_for", {
                                                direction: t(`pages.agent_workspace.deal.itinerary.${leg.direction}`),
                                            })}
                                        </span>
                                    </a>
                                ))}
                            </div>
                        )}
                        {transferLeg ? (
                            <div className="agent-trip__warn">
                                <b>
                                    {t(
                                        transferLeg.direction === FlightDirection.ARRIVAL
                                            ? "pages.agent_workspace.deal.itinerary.arrival_transfer"
                                            : "pages.agent_workspace.deal.itinerary.departure_transfer",
                                    )}
                                </b>{" "}
                                {t("pages.agent_workspace.deal.itinerary.transfer_hint")}
                            </div>
                        ) : null}
                    </AgentDialogSection>
                </div>
            </AgentDialog>
            <DealItineraryModal open={editing} onClose={() => setEditing(false)} dealId={deal.id} leg={focus?.raw ?? null} />
            <ConfirmDialog
                open={confirmDelete}
                danger
                title={t("pages.agent_workspace.deal.itinerary.delete_title")}
                message={t("pages.agent_workspace.deal.itinerary.delete_message")}
                confirmLabel={t("pages.agent_workspace.deal.itinerary.delete_flight")}
                cancelLabel={t("pages.agent_workspace.deal.itinerary.cancel")}
                zIndex={1400}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={() => {
                    if (!focus) return;
                    setConfirmDelete(false);
                    deleteLeg(focus.id, onClose);
                }}
            />
        </>
    );
}
