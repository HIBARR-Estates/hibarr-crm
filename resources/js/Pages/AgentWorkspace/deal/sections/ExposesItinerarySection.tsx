import { useState } from "react";
import { usePage } from "@inertiajs/react";
import { Dropdown, type MenuProps } from "antd";
import type { PageProps } from "@/Components/DashboardLayout";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { isDealEffectivelyLocked } from "@/lib/dealOutcome";
import {
    canManageDealExposes,
    downloadDealExpose,
    exposeStatusMeta,
    formatExposeDate,
} from "@/Pages/Deals/Redesign/adapters/dealExposeAdapter";
import { toWorkspaceItineraryItem } from "@/Pages/Deals/Redesign/adapters/itineraryAdapter";
import AddExposeModal from "@/Pages/Deals/Redesign/components/workspace/AddExposeModal";
import DealItineraryModal from "@/Pages/Deals/Redesign/components/workspace/DealItineraryModal";
import useDealExposes from "@/Pages/Deals/Redesign/hooks/useDealExposes";
import type { AppPermission } from "@/Types/permission";
import type { Deal } from "@/Types/api/deals";
import type { ILeadFlightItinerary } from "@/Types/api/lead-flight-itinerary";
import SectionCard, { SectionEmpty, SectionSkeleton } from "./SectionCard";

interface ExposesItinerarySectionProps {
    deal: Deal;
    /** The exposés list is behind the exposés flag and view_lead_proposals. */
    showExposes: boolean;
    canEdit: boolean;
}

/**
 * What the buyer has been shown and how they are travelling: the deal's
 * exposés, each with its status, and its flights. Both add through the deal
 * page's own dialogs.
 */
export default function ExposesItinerarySection({ deal, showExposes, canEdit }: ExposesItinerarySectionProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props: pageProps } = usePage<PageProps>();
    const permissions = pageProps.auth?.permissions as AppPermission | undefined;
    const { exposes, loading, saving, isUploadingFile, uploadProgress, uploadBytesLoaded, uploadBytesTotal, cancelUpload, addExpose } =
        useDealExposes({ type: "deal", dealId: deal.id });
    const [addSource, setAddSource] = useState<"linked" | "manual" | null>(null);
    const [legOpen, setLegOpen] = useState(false);
    const [editingLeg, setEditingLeg] = useState<ILeadFlightItinerary | null>(null);

    const editableExposes = canEdit && !isDealEffectivelyLocked(deal) && canManageDealExposes(permissions);
    const legs = (deal.lead_flight_itineraries ?? []).filter((leg) => leg.id != null).map(toWorkspaceItineraryItem);
    const currencySymbol = deal.currency?.currency_symbol || "£";

    const addMenu: MenuProps["items"] = [
        { key: "linked", label: t("pages.deals.workspace.exposes.add_linked") },
        { key: "manual", label: t("pages.deals.workspace.exposes.add_manual") },
    ];

    return (
        <SectionCard id="deal-exposes" title={t("pages.agent_workspace.deal.exposes.title")} className="agent-deal__section--split">
            {showExposes ? (
                <div className="agent-deal__block">
                    {loading && exposes.length === 0 ? (
                        <SectionSkeleton />
                    ) : exposes.length === 0 ? (
                        <SectionEmpty>{t("pages.agent_workspace.deal.exposes.empty")}</SectionEmpty>
                    ) : (
                        <ul className="agent-deal__rows">
                            {exposes.map((expose) => {
                                const meta = exposeStatusMeta(expose.status);
                                const openable = Boolean(expose.download_url);
                                return (
                                    <li key={expose.id}>
                                        <button
                                            type="button"
                                            className="agent-deal__row agent-deal__row--expose"
                                            onClick={() => downloadDealExpose(expose)}
                                            disabled={!openable}
                                        >
                                            <span className="agent-deal__thumb" aria-hidden="true">
                                                <Icon name="building" size={20} />
                                            </span>
                                            <span className="agent-deal__row-body">
                                                <span className="agent-deal__row-title">{expose.title}</span>
                                                <span className="agent-deal__row-sub">
                                                    {[td(meta.label, { source: "en" }), formatExposeDate(expose)].filter(Boolean).join(" · ")}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {editableExposes ? (
                        <div className="agent-deal__block-action">
                            <Dropdown menu={{ items: addMenu, onClick: ({ key }) => setAddSource(key as "linked" | "manual") }} trigger={["click"]}>
                                <span className="agent-contact__menu-anchor">
                                    <Button size="sm" className="agent-btn-soft" aria-haspopup="menu">
                                        <Icon name="plus" size={12} />
                                        {t("pages.agent_workspace.deal.exposes.add")}
                                        <Icon name="chevron-down" size={12} />
                                    </Button>
                                </span>
                            </Dropdown>
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div id="deal-itinerary" className="agent-deal__block">
                {legs.length === 0 ? (
                    <div className="agent-deal__row">
                        <span className="agent-deal__row-title">{t("pages.agent_workspace.deal.itinerary.title")}</span>
                        <span className="agent-deal__row-sub">{t("pages.agent_workspace.deal.itinerary.empty")}</span>
                    </div>
                ) : (
                    <ul className="agent-deal__rows">
                        {legs.map((leg) => (
                            <li key={leg.id}>
                                <button
                                    type="button"
                                    className="agent-deal__row"
                                    disabled={!canEdit}
                                    onClick={() => {
                                        setEditingLeg(leg.raw);
                                        setLegOpen(true);
                                    }}
                                >
                                    <span className="agent-deal__row-body">
                                        <span className="agent-deal__row-title">
                                            {t(`pages.agent_workspace.deal.itinerary.${leg.direction}`)} · {leg.airportLabel}
                                        </span>
                                        <span className="agent-deal__row-sub">
                                            {[leg.dateTimeLabel, leg.flightNumberLabel !== "—" ? leg.flightNumberLabel : ""].filter(Boolean).join(" · ")}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {canEdit ? (
                    <div className="agent-deal__block-action">
                        <Button
                            size="sm"
                            className="agent-btn-soft"
                            onClick={() => {
                                setEditingLeg(null);
                                setLegOpen(true);
                            }}
                        >
                            <Icon name="plus" size={12} />
                            {t("pages.agent_workspace.deal.itinerary.add")}
                        </Button>
                    </div>
                ) : null}
            </div>

            {addSource ? (
                <AddExposeModal
                    open
                    source={addSource}
                    dealId={deal.id}
                    currencySymbol={currencySymbol}
                    saving={saving}
                    isUploadingFile={isUploadingFile}
                    uploadProgress={uploadProgress}
                    uploadBytesLoaded={uploadBytesLoaded}
                    uploadBytesTotal={uploadBytesTotal}
                    onCancelUpload={cancelUpload}
                    onSubmit={async (input) => {
                        const failure = await addExpose(input);
                        if (failure === null) setAddSource(null);
                        return failure;
                    }}
                    onClose={() => setAddSource(null)}
                />
            ) : null}
            <DealItineraryModal open={legOpen} onClose={() => setLegOpen(false)} dealId={deal.id} leg={editingLeg} />
        </SectionCard>
    );
}
