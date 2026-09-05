import { useMemo, useState } from "react";
import { Link } from "@inertiajs/react";
import {
    ItineraryEmptyState,
    ItineraryFilterEmptyState,
} from "@/Components/Redesign/workspace/WorkspaceEmptyStates";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TdFn } from "@/lib/dynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import {
    FlightDirection,
    type ILeadFlightItinerary,
} from "@/Types/api/lead-flight-itinerary";
import {
    sortItineraryItems,
    toWorkspaceItineraryItem,
    type WorkspaceItineraryItem,
} from "@/Pages/Deals/Redesign/adapters/itineraryAdapter";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import DealConfirmDialog from "@/Pages/Deals/Redesign/components/primitives/DealConfirmDialog";
import DealIcon from "@/Pages/Deals/Redesign/components/primitives/DealIcon";
import {
    DEAL_REDESIGN_RADIUS as R,
    DEAL_REDESIGN_TOKENS as T,
    DEAL_REDESIGN_TYPE as TY,
} from "@/Pages/Deals/Redesign/tokens";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadItineraryMutations from "../../../hooks/useLeadItineraryMutations";
import LeadItineraryModal from "../LeadItineraryModal";

interface ItineraryTabProps {
    canEdit?: boolean;
}

type ItineraryFilter = "all" | "arrival" | "departure" | "transfer";

interface DealRef {
    id: number;
    name: string;
}

function collectLeadFlights(
    deals: Array<{
        id: number;
        name?: string | null;
        lead_flight_itineraries?: ILeadFlightItinerary[];
    }>,
    leadLegs: ILeadFlightItinerary[] | undefined,
): { legs: ILeadFlightItinerary[]; dealById: Map<number, DealRef> } {
    const dealById = new Map<number, DealRef>();
    const byId = new Map<number, ILeadFlightItinerary>();

    for (const deal of deals) {
        dealById.set(deal.id, {
            id: deal.id,
            name: deal.name?.trim() || `Deal #${deal.id}`,
        });
        for (const leg of deal.lead_flight_itineraries ?? []) {
            if (leg.id == null) continue;
            byId.set(leg.id, {
                ...leg,
                deal_id: leg.deal_id ?? deal.id,
            });
        }
    }

    for (const leg of leadLegs ?? []) {
        if (leg.id == null) continue;
        if (!byId.has(leg.id)) {
            byId.set(leg.id, leg);
        }
    }

    return { legs: Array.from(byId.values()), dealById };
}

function ItineraryCard({
    leg,
    deal,
    isPastSection,
    canEdit,
    deletingId,
    onEdit,
    onDelete,
    ft,
    t,
    td,
}: {
    leg: WorkspaceItineraryItem;
    deal: DealRef | null;
    isPastSection: boolean;
    canEdit: boolean;
    deletingId: number | null;
    onEdit: (leg: ILeadFlightItinerary) => void;
    onDelete: (leg: ILeadFlightItinerary) => void;
    ft: (key: string) => string;
    t: (key: string) => string;
    td: TdFn;
}) {
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
                    {deal ? (
                        <Link
                            href={route("deals.show", deal.id)}
                            className="dr-pill dr-pill-gray"
                            style={{
                                textDecoration: "none",
                                maxWidth: 220,
                            }}
                            title={deal.name}
                        >
                            <span
                                style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {deal.name}
                            </span>
                        </Link>
                    ) : (
                        <span className="dr-pill dr-pill-gray">
                            {td("No deal", { source: "en" })}
                        </span>
                    )}
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
                {canEdit && (
                    <DealButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(leg.raw)}
                    >
                        {t("pages.deals.common.edit")}
                    </DealButton>
                )}
                {canEdit && (
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{
                            color: T.RED,
                            background: "transparent",
                            border: "none",
                        }}
                        disabled={deletingId === leg.id}
                        onClick={() => onDelete(leg.raw)}
                    >
                        {t("pages.deals.common.delete")}
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * Lead itinerary — all flights across deals, each card linking to its deal.
 */
export default function ItineraryTab({ canEdit = true }: ItineraryTabProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const ft = (key: string) => t(`pages.flight_itinerary.${key}`);
    const { deals, lead } = useLeadWorkspace();
    const { deleteLeg, deletingId } = useLeadItineraryMutations();

    const [filter, setFilter] = useState<ItineraryFilter>("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingLeg, setEditingLeg] = useState<ILeadFlightItinerary | null>(
        null,
    );
    const [confirmDeleteLeg, setConfirmDeleteLeg] =
        useState<ILeadFlightItinerary | null>(null);

    const { legs, dealById } = useMemo(
        () => collectLeadFlights(deals, lead.lead_flight_itineraries),
        [deals, lead.lead_flight_itineraries],
    );

    const defaultDealId = deals[0]?.id ?? null;

    const items = useMemo(() => legs.map(toWorkspaceItineraryItem), [legs]);

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

    const sections = (
        [
            { label: "Upcoming" as const, items: upcoming },
            { label: "Past" as const, items: past },
        ] as const
    ).filter((section) => section.items.length > 0);

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

    const modalDealId =
        editingLeg?.deal_id ?? defaultDealId ?? deals[0]?.id ?? null;

    const addFlightButton = canEdit ? (
        <DealButton
            variant="primary"
            size="sm"
            icon={<DealIcon name="plus" size={14} />}
            onClick={openCreate}
        >
            {ft("add_flight")}
        </DealButton>
    ) : null;

    // No flights at all: no toolbar, no filters — just the empty state and its
    // single call to action, the same shape every other tab uses.
    if (legs.length === 0) {
        return (
            <div className="space-y-4">
                <ItineraryEmptyState onAdd={canEdit ? openCreate : undefined} />
                {modalOpen && (
                    <LeadItineraryModal
                        open={modalOpen}
                        onClose={closeModal}
                        leadId={lead.id}
                        dealId={modalDealId}
                        leg={editingLeg}
                    />
                )}
            </div>
        );
    }

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
                {addFlightButton}
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
                <ItineraryFilterEmptyState
                    entity="lead"
                    onShowAll={() => setFilter("all")}
                />
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
                                        deal={
                                            leg.raw.deal_id != null
                                                ? (dealById.get(
                                                      leg.raw.deal_id,
                                                  ) ?? null)
                                                : null
                                        }
                                        isPastSection={isPastSection}
                                        canEdit={canEdit}
                                        deletingId={deletingId}
                                        onEdit={openEdit}
                                        onDelete={setConfirmDeleteLeg}
                                        ft={ft}
                                        t={t}
                                        td={td}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })
            )}

            {modalOpen && (
                <LeadItineraryModal
                    open={modalOpen}
                    onClose={closeModal}
                    leadId={lead.id}
                    dealId={modalDealId}
                    leg={editingLeg}
                />
            )}

            <DealConfirmDialog
                open={confirmDeleteLeg != null}
                title={ft("delete_flight")}
                message={ft("delete_confirm")}
                confirmLabel={ft("delete_flight")}
                danger
                confirmLoading={
                    confirmDeleteLeg?.id != null &&
                    deletingId === confirmDeleteLeg.id
                }
                onConfirm={() => {
                    if (confirmDeleteLeg != null) {
                        deleteLeg(confirmDeleteLeg, () =>
                            setConfirmDeleteLeg(null),
                        );
                    }
                }}
                onCancel={() => setConfirmDeleteLeg(null)}
            />
        </div>
    );
}
