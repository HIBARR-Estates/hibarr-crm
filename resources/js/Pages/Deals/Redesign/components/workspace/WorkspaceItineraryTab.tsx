import { useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import type { Deal } from "@/Types/api/deals";
import {
    FlightDirection,
    ILeadFlightItinerary,
} from "@/Types/api/lead-flight-itinerary";
import {
    sortItineraryItems,
    toWorkspaceItineraryItem,
    type WorkspaceItineraryItem,
} from "../../adapters/itineraryAdapter";
import useDealItinerary from "../../hooks/useDealItinerary";
import DealItineraryModal from "./DealItineraryModal";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import {
    DEAL_REDESIGN_RADIUS as R,
    DEAL_REDESIGN_TOKENS as T,
    DEAL_REDESIGN_TYPE as TY,
} from "../../tokens";

type ItineraryFilter = "all" | "arrival" | "departure" | "transfer";

interface WorkspaceItineraryTabProps {
    deal: Deal;
    canAdd: boolean;
    canDelete: boolean;
}

interface ItineraryCardProps {
    leg: WorkspaceItineraryItem;
    isPastSection: boolean;
    canAdd: boolean;
    canDelete: boolean;
    deletingId: number | null;
    onEdit: (leg: ILeadFlightItinerary) => void;
    onDelete: (id: number) => void;
    ft: (key: string) => string;
    t: (key: string) => string;
}

function ItineraryCard({
    leg,
    isPastSection,
    canAdd,
    canDelete,
    deletingId,
    onEdit,
    onDelete,
    ft,
    t,
}: ItineraryCardProps) {
    const isArrival = leg.direction === FlightDirection.ARRIVAL;

    return (
        <div
            className="flex items-stretch gap-3"
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: R.LG,
                padding: "14px 16px",
                opacity: isPastSection ? 0.8 : 1,
            }}
        >
            <div
                className="flex flex-col overflow-hidden"
                style={{
                    width: 52,
                    flexShrink: 0,
                    borderRadius: R.MD,
                    border: `1px solid ${
                        isPastSection
                            ? T.BORDER
                            : isArrival
                              ? T.GREEN_MID
                              : T.BLUE_MID
                    }`,
                    background: isPastSection ? T.SURFACE_2 : T.WHITE,
                }}
                aria-hidden
            >
                <span
                    className="text-center font-semibold uppercase"
                    style={{
                        fontSize: TY.CAPTION,
                        letterSpacing: "0.06em",
                        color: T.WHITE,
                        background: isPastSection
                            ? T.GRAY_DARK
                            : isArrival
                              ? T.GREEN
                              : T.BLUE,
                        padding: "5px 0 4px",
                        lineHeight: 1,
                    }}
                >
                    {leg.monthLabel}
                </span>
                <span
                    className="flex flex-1 items-center justify-center font-bold leading-none"
                    style={{
                        fontSize: TY.DISPLAY,
                        color: isPastSection ? T.TEXT_MUTED : T.NAVY,
                        padding: "8px 0 10px",
                    }}
                >
                    {leg.dayLabel}
                </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span
                        className={`dr-pill dr-pill-${
                            isArrival ? "green" : "blue"
                        }`}
                    >
                        {isArrival ? ft("arrival") : ft("departure")}
                    </span>
                    <span
                        className={`dr-pill ${
                            leg.isTransferRequired
                                ? "dr-pill-amber"
                                : "dr-pill-gray"
                        }`}
                    >
                        {leg.isTransferRequired
                            ? ft("transfer_needed")
                            : ft("no_transfer")}
                    </span>
                </div>

                <div
                    className="truncate font-semibold"
                    style={{
                        fontSize: TY.HEADING,
                        color: T.TEXT,
                        lineHeight: 1.3,
                    }}
                    title={leg.airportLabel}
                >
                    {leg.airportLabel}
                </div>

                <div
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                    style={{
                        fontSize: TY.BODY,
                        color: T.TEXT_MUTED,
                    }}
                >
                    <span
                        className="inline-flex items-center gap-1.5 font-semibold"
                        style={{
                            color: isPastSection ? T.TEXT_MUTED : T.NAVY,
                        }}
                    >
                        <DealIcon
                            name="clock"
                            size={13}
                            color={isPastSection ? T.TEXT_MUTED : T.BLUE}
                        />
                        {leg.timeLabel}
                    </span>
                    <span style={{ color: T.TEXT_HINT }}>·</span>
                    <span>{leg.dateLabel}</span>
                    {leg.flightNumberLabel !== "—" && (
                        <>
                            <span style={{ color: T.TEXT_HINT }}>·</span>
                            <span style={{ color: T.TEXT_HINT }}>
                                {leg.flightNumberLabel}
                            </span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-shrink-0 flex-col items-end justify-center gap-1.5 sm:flex-row sm:items-center">
                {canAdd && (
                    <DealButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(leg.raw)}
                    >
                        {t("pages.deals.common.edit")}
                    </DealButton>
                )}
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
                        onClick={() => onDelete(leg.id)}
                    >
                        {t("pages.deals.common.delete")}
                    </button>
                )}
            </div>
        </div>
    );
}

/** Flight itinerary list for the deal workspace — cards emphasise airport,
 * date/time, direction, and transfer need. Create/edit share DealItineraryModal. */
export default function WorkspaceItineraryTab({
    deal,
    canAdd,
    canDelete,
}: WorkspaceItineraryTabProps) {
    const { t } = useTranslation();
    const ft = (key: string) => t(`pages.flight_itinerary.${key}`);
    const [filter, setFilter] = useState<ItineraryFilter>("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingLeg, setEditingLeg] = useState<ILeadFlightItinerary | null>(
        null,
    );
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const { deleteLeg, deletingId } = useDealItinerary(deal.id);

    const items = useMemo(
        () => (deal.lead_flight_itineraries ?? []).map(toWorkspaceItineraryItem),
        [deal.lead_flight_itineraries],
    );

    const filtered = useMemo(
        () =>
            items.filter((leg) => {
                if (filter === "arrival") {
                    return leg.direction === FlightDirection.ARRIVAL;
                }
                if (filter === "departure") {
                    return leg.direction === FlightDirection.DEPARTURE;
                }
                if (filter === "transfer") return leg.isTransferRequired;
                return true;
            }),
        [filter, items],
    );

    const upcoming = useMemo(
        () =>
            sortItineraryItems(
                filtered.filter((leg) => leg.isUpcoming),
                "upcoming",
            ),
        [filtered],
    );
    const past = useMemo(
        () =>
            sortItineraryItems(
                filtered.filter((leg) => leg.isPast || !leg.startsAt),
                "past",
            ),
        [filtered],
    );

    const filterOptions: Array<{ id: ItineraryFilter; label: string }> = [
        { id: "all", label: ft("filter_all") },
        { id: "arrival", label: ft("filter_arrivals") },
        { id: "departure", label: ft("filter_departures") },
        { id: "transfer", label: ft("filter_transfer_needed") },
    ];

    const openCreate = () => {
        setEditingLeg(null);
        setModalOpen(true);
    };

    const openEdit = (leg: ILeadFlightItinerary) => {
        setEditingLeg(leg);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingLeg(null);
    };

    const sections = (
        [
            { label: "Upcoming" as const, items: upcoming },
            { label: "Past" as const, items: past },
        ] as const
    ).filter((section) => section.items.length > 0);

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
                <div
                    className="flex flex-wrap gap-1"
                    role="group"
                    aria-label={t(
                        "pages.deals.workspace.itinerary.filter_aria_label",
                    )}
                >
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
                        onClick={openCreate}
                    >
                        + {ft("add_flight")}
                    </DealButton>
                )}
            </div>

            {filtered.length > 0 && (
                <div
                    className="mb-3"
                    style={{ fontSize: TY.CAPTION, color: T.TEXT_MUTED }}
                >
                    {upcoming.length}{" "}
                    {t("pages.deals.workspace.meetings.upcoming_label")} ·{" "}
                    {past.length}{" "}
                    {t("pages.deals.workspace.meetings.past_label")}
                </div>
            )}

            {filtered.length === 0 ? (
                <div
                    role="status"
                    className="rounded-[10px] border border-dashed px-3.5 py-6 text-center"
                    style={{ borderColor: T.BORDER, background: T.SURFACE_2 }}
                >
                    <div
                        className="mb-[3px] font-semibold"
                        style={{ fontSize: TY.BODY, color: T.TEXT }}
                    >
                        {ft("empty")}
                    </div>
                    <div style={{ fontSize: TY.CAPTION, color: T.TEXT_MUTED }}>
                        {t(
                            "Track the client's inspection-trip flights and airport transfers here.",
                        )}
                    </div>
                </div>
            ) : (
                sections.map((section) => {
                    const isPastSection = section.label === "Past";
                    return (
                        <section key={section.label} className="mb-3">
                            <div className="dr-label mb-2">
                                {section.label === "Upcoming"
                                    ? t(
                                          "pages.deals.workspace.meetings.section_upcoming",
                                      )
                                    : t(
                                          "pages.deals.workspace.meetings.section_past",
                                      )}
                            </div>
                            <div className="flex flex-col gap-2.5">
                                {section.items.map((leg) => (
                                    <ItineraryCard
                                        key={leg.id}
                                        leg={leg}
                                        isPastSection={isPastSection}
                                        canAdd={canAdd}
                                        canDelete={canDelete}
                                        deletingId={deletingId}
                                        onEdit={openEdit}
                                        onDelete={setConfirmDeleteId}
                                        ft={ft}
                                        t={t}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })
            )}

            <DealItineraryModal
                open={modalOpen}
                onClose={closeModal}
                dealId={deal.id}
                leg={editingLeg}
            />

            <DealConfirmDialog
                open={confirmDeleteId != null}
                title={ft("delete_flight")}
                message={ft("delete_confirm")}
                confirmLabel={ft("delete_flight")}
                danger
                confirmLoading={
                    confirmDeleteId != null && deletingId === confirmDeleteId
                }
                onConfirm={() => {
                    if (confirmDeleteId != null) {
                        deleteLeg(confirmDeleteId, () =>
                            setConfirmDeleteId(null),
                        );
                    }
                }}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    );
}
