import { useEffect, useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { Button, EmptyState, Icon } from "@/Components/Redesign";
import {
    DealWorkspaceProvider,
    useDealWorkspace,
} from "@/Pages/Deals/Redesign/context/DealWorkspaceContext";
import WorkspaceItineraryTab from "@/Pages/Deals/Redesign/components/workspace/WorkspaceItineraryTab";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";

interface ItineraryTabProps {
    onCreateDeal?: () => void;
    canEdit?: boolean;
}

function ItineraryWorkspaceContent({ canEdit }: { canEdit: boolean }) {
    const { deal } = useDealWorkspace();
    const { setDeals } = useLeadWorkspace();

    useEffect(() => {
        setDeals((prev) =>
            prev.map((item) =>
                item.id === deal.id
                    ? {
                          ...item,
                          lead_flight_itineraries: deal.lead_flight_itineraries,
                      }
                    : item,
            ),
        );
    }, [deal.id, deal.lead_flight_itineraries, setDeals]);

    return (
        <WorkspaceItineraryTab
            deal={deal}
            canAdd={canEdit}
            canDelete={canEdit}
        />
    );
}

function ItineraryForDeal({
    dealId,
    canEdit,
}: {
    dealId: number;
    canEdit: boolean;
}) {
    const { deals } = useLeadWorkspace();

    // Seed the nested Deal workspace once per deal id. Re-feeding a new deal
    // object on every LeadWorkspace itinerary sync was resetting the provider
    // and wiping legs that had just been appended.
    const seedDeal = useMemo(() => {
        return deals.find((deal) => deal.id === dealId) ?? deals[0];
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally seed on deal switch only
    }, [dealId]);

    if (!seedDeal) return null;

    return (
        <DealWorkspaceProvider key={dealId} deal={seedDeal}>
            <ItineraryWorkspaceContent canEdit={canEdit} />
        </DealWorkspaceProvider>
    );
}

export default function ItineraryTab({
    onCreateDeal,
    canEdit = true,
}: ItineraryTabProps) {
    const { td } = useTd();
    const { deals } = useLeadWorkspace();
    const [selectedDealId, setSelectedDealId] = useState<number | null>(
        () => deals[0]?.id ?? null,
    );

    const selectedDeal = useMemo(
        () => deals.find((deal) => deal.id === selectedDealId) ?? deals[0],
        [deals, selectedDealId],
    );

    useEffect(() => {
        if (deals.length === 0) {
            setSelectedDealId(null);
            return;
        }
        if (!deals.some((deal) => deal.id === selectedDealId)) {
            setSelectedDealId(deals[0].id);
        }
    }, [deals, selectedDealId]);

    if (deals.length === 0) {
        return (
            <div className="space-y-4">
                <EmptyState
                    title={td("No deals yet")}
                    description={td(
                        "Create a deal to track inspection-trip flights and airport transfers.",
                    )}
                />
                {onCreateDeal && (
                    <Button
                        variant="primary"
                        icon={<Icon name="plus" size={14} />}
                        onClick={onCreateDeal}
                    >
                        {td("Create deal")}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div>
            {deals.length > 1 && selectedDeal && (
                <div className="mb-4">
                    <label
                        htmlFor="lead-itinerary-deal-picker"
                        className="mb-1 block text-xs font-medium text-[#6b7280]"
                    >
                        {td("Deal")}
                    </label>
                    <select
                        id="lead-itinerary-deal-picker"
                        className="dr-input max-w-md"
                        value={selectedDeal.id}
                        onChange={(event) =>
                            setSelectedDealId(Number(event.target.value))
                        }
                    >
                        {deals.map((deal) => (
                            <option key={deal.id} value={deal.id}>
                                {deal.name ?? td("Deal")} #{deal.id}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {selectedDeal && (
                <ItineraryForDeal dealId={selectedDeal.id} canEdit={canEdit} />
            )}
        </div>
    );
}
