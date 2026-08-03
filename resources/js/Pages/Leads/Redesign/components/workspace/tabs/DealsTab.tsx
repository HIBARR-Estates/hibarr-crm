import { useState } from "react";
import { router } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { Button, EmptyState, Icon } from "@/Components/Redesign";
import type { Deal } from "@/Types/api/deals";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadDealCreate from "../../../hooks/useLeadDealCreate";
import CreateDealModal, {
    type LeadDealMeta,
} from "../../dealCreate/CreateDealModal";
import DealCard from "../cards/DealCard";

interface DealsTabProps {
    dealMeta?: LeadDealMeta;
}

export default function DealsTab({ dealMeta }: DealsTabProps) {
    const { td } = useTd();
    const { lead, deals } = useLeadWorkspace();
    const [modalOpen, setModalOpen] = useState(false);

    const { createDeal, isCreating, errors, clearErrors } =
        useLeadDealCreate(lead);

    const openDeal = (deal: Deal) => {
        router.visit(route("deals.show", deal.id));
    };

    return (
        <div>
            <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-xs text-[#6b7280]">
                    {deals.length} deal{deals.length === 1 ? "" : "s"}
                </span>
                <Button
                    variant="primary"
                    icon={<Icon name="plus" size={14} />}
                    onClick={() => {
                        clearErrors();
                        setModalOpen(true);
                    }}
                >
                    {td("Create deal")}
                </Button>
            </div>

            {deals.length === 0 ? (
                <EmptyState
                    title={td("No deals yet")}
                    description={td(
                        "Convert this lead by creating their first deal.",
                    )}
                />
            ) : (
                deals.map((deal) => (
                    <DealCard
                        key={deal.id}
                        deal={deal}
                        onClick={() => openDeal(deal)}
                    />
                ))
            )}

            <CreateDealModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                saving={isCreating}
                errors={errors}
                dealMeta={dealMeta}
                defaultAgentId={lead.lead_owner?.id ?? null}
                onSubmit={(input) =>
                    createDeal(input, () => setModalOpen(false))
                }
            />
        </div>
    );
}
