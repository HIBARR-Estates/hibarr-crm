import { useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import EditProposal from "@/Pages/Deals/Components/Tabs/proposals/EditProposal";
import type { Deal } from "@/Types/api/deals";
import type { Proposal } from "@/Types/api/proposal";
import { toWorkspaceOfferListItem } from "../../adapters/proposalAdapter";
import useDealProposalCreate from "../../hooks/useDealProposalCreate";
import useDealProposalSend from "../../hooks/useDealProposalSend";
import DealBadge from "../primitives/DealBadge";
import DealButton from "../primitives/DealButton";
import { DealModalField } from "../primitives/DealModal";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface WorkspaceOffersTabProps {
    deal: Deal;
    proposals: Proposal[];
    permissions: Record<string, string>;
}

function canAddProposal(permissions: Record<string, string>): boolean {
    return (
        permissions.add_lead_proposals === "all" ||
        permissions.add_lead_proposals === "added"
    );
}

function canEditProposal(
    proposal: Proposal,
    permissions: Record<string, string>,
    userId?: number,
): boolean {
    return (
        !proposal.signature &&
        (permissions.edit_lead_proposals === "all" ||
            (permissions.edit_lead_proposals === "added" &&
                proposal.added_by === userId))
    );
}

const inputClassName =
    "w-full rounded-md border border-[#e2e5ea] px-2.5 py-2 text-[13px] text-[#1a1f2e] outline-none focus:border-[#1a6bb5]";

export default function WorkspaceOffersTab({
    deal,
    proposals,
    permissions,
}: WorkspaceOffersTabProps) {
    const { td } = useTd();
    const { props } = usePage();
    const user = props.auth?.user;
    const [offerFormOpen, setOfferFormOpen] = useState(false);
    const [property, setProperty] = useState("");
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const { createProposal, isSaving, errors, clearErrors } =
        useDealProposalCreate(deal);
    const { sendProposal, sendingId } = useDealProposalSend();

    const sentToName =
        deal.contact?.client_name_salutation ||
        deal.contact?.client_name ||
        null;

    const offerItems = useMemo(
        () =>
            proposals.map((proposal) =>
                toWorkspaceOfferListItem(proposal, {
                    sentToName,
                    canEdit: canEditProposal(proposal, permissions, user?.id),
                }),
            ),
        [permissions, proposals, sentToName, user?.id],
    );

    const showAddOffer = canAddProposal(permissions);
    const currencySymbol = deal.currency?.currency_symbol || "£";

    const resetForm = () => {
        setProperty("");
        setAmount("");
        setNotes("");
        clearErrors();
    };

    const handleToggleForm = () => {
        if (offerFormOpen) {
            resetForm();
        }
        setOfferFormOpen((open) => !open);
    };

    const handleSave = () => {
        createProposal({ property, amount, notes }, () => {
            resetForm();
            setOfferFormOpen(false);
        });
    };

    return (
        <div>
            <div className="mb-3.5 flex items-center justify-between gap-3">
                <span className="text-xs text-[#6b7280]">
                    {offerItems.length} {td("offer")}
                    {offerItems.length !== 1 ? "s" : ""} {td("on this deal")}
                </span>

                {showAddOffer && (
                    <DealButton variant="navy" onClick={handleToggleForm}>
                        {offerFormOpen ? td("Cancel") : `+ ${td("New offer")}`}
                    </DealButton>
                )}
            </div>

            {offerFormOpen && (
                <section className="mb-3.5 overflow-hidden rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3.5">
                    {errors.length > 0 && (
                        <div className="mb-2 space-y-1">
                            {errors.map((error, index) => (
                                <p key={index} className="text-xs text-red-600">
                                    {error}
                                </p>
                            ))}
                        </div>
                    )}

                    <DealModalField label={td("Property")}>
                        <input
                            value={property}
                            onChange={(event) => setProperty(event.target.value)}
                            placeholder={td("e.g. 2BR Apt — Bellapais")}
                            className={inputClassName}
                        />
                    </DealModalField>

                    <DealModalField label={td("Offer amount")}>
                        <input
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            placeholder={`${td("e.g.")} ${currencySymbol}185,000`}
                            className={inputClassName}
                        />
                    </DealModalField>

                    <DealModalField label={td("Notes")}>
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            rows={2}
                            placeholder={td(
                                "Payment terms, validity...",
                            )}
                            className={`${inputClassName} resize-y`}
                        />
                    </DealModalField>

                    <div className="flex justify-end gap-2 border-t border-[#e2e5ea] pt-2">
                        <DealButton variant="ghost" onClick={handleToggleForm}>
                            {td("Cancel")}
                        </DealButton>
                        <DealButton
                            variant="navy"
                            onClick={handleSave}
                            disabled={
                                !property.trim() ||
                                !amount.trim() ||
                                isSaving
                            }
                            loading={isSaving}
                        >
                            {td("Save draft")}
                        </DealButton>
                    </div>
                </section>
            )}

            {offerItems.length === 0 ? (
                <p className="px-1 text-[13px] italic text-[#9ca3af]">
                    {td("No offers yet")}
                </p>
            ) : (
                offerItems.map((offer) => (
                    <article
                        key={offer.id}
                        className="mb-2.5 rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3.5 last:mb-0"
                    >
                        <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="mb-0.5 text-sm font-semibold text-[#1a1f2e]">
                                    {offer.property}
                                </div>
                                <div
                                    className="text-base font-semibold"
                                    style={{ color: T.NAVY }}
                                >
                                    {offer.amountLabel}
                                </div>
                            </div>
                            <DealBadge variant={offer.statusBadgeVariant}>
                                {td(offer.statusLabel)}
                            </DealBadge>
                        </div>

                        <div className="mb-2 text-[11px] text-[#9ca3af]">
                            {td("Updated")} {offer.updatedLabel}
                            {offer.sentToLabel
                                ? ` · ${td("Sent to")} ${offer.sentToLabel}`
                                : ""}
                            {offer.validUntilLabel
                                ? ` · ${td("Valid until")} ${offer.validUntilLabel}`
                                : ""}
                        </div>

                        {offer.notes && (
                            <div className="mb-2.5 text-xs italic leading-relaxed text-[#6b7280]">
                                {offer.notes}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-1.5 border-t border-[#e2e5ea] pt-2">
                            {offer.canSend && (
                                <DealButton
                                    variant="primary"
                                    onClick={() => sendProposal(offer.id)}
                                    loading={sendingId === offer.id}
                                >
                                    {td("Send to client")}
                                </DealButton>
                            )}

                            <DealButton
                                variant="ghost"
                                onClick={() =>
                                    window.open(
                                        route("proposals.download", offer.id),
                                        "_blank",
                                    )
                                }
                            >
                                {td("View PDF")}
                            </DealButton>

                            {offer.canEdit && (
                                <EditProposal
                                    deal={deal}
                                    proposal={offer.proposal}
                                    permissions={permissions}
                                    user={user}
                                    onSuccess={() =>
                                        router.reload({ only: ["proposals"] })
                                    }
                                    trigger="custom"
                                >
                                    <DealButton variant="ghost">
                                        {td("Edit")}
                                    </DealButton>
                                </EditProposal>
                            )}
                        </div>
                    </article>
                ))
            )}
        </div>
    );
}
