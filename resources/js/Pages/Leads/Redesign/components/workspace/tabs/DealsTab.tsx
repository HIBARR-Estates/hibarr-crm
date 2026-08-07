import { useState } from "react";
import { router, usePage } from "@inertiajs/react";
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
    meetingTypes?: Array<{ id: number; name: string; color?: string }>;
}

export default function DealsTab({
    dealMeta,
    meetingTypes: meetingTypesProp,
}: DealsTabProps) {
    const { td } = useTd();
    const { props } = usePage<any>();
    const { lead, deals } = useLeadWorkspace();
    const [modalOpen, setModalOpen] = useState(false);
    const meetingTypes = meetingTypesProp ?? props.meetingTypes ?? [];

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
                    {td(
                        deals.length === 0
                            ? "Create deal"
                            : "Create another deal",
                    )}
                </Button>
            </div>

            {deals.length === 0 ? (
                <EmptyState
                    title={td("No deals yet")}
                    description={td(
                        "Create a deal for this lead. You can add more deals later.",
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
                meetingTypes={meetingTypes}
                defaultAgentId={(() => {
                    const ownerUserId = lead.lead_owner?.id;
                    if (!ownerUserId) return null;
                    const match = (dealMeta?.leadAgents ?? []).find(
                        (agent) =>
                            agent.user_id === ownerUserId ||
                            agent.user?.id === ownerUserId,
                    );
                    return match?.id ?? null;
                })()}
                onSubmit={(input) =>
                    createDeal(input, () => setModalOpen(false))
                }
            />
        </div>
    );
}
