import type { Deal } from "@/Types/api/deals";
import DealPaymentPanel from "./DealPaymentPanel";

interface WorkspacePaymentsTabProps {
    deal: Deal;
    canCreatePaymentRequest: boolean;
    canConfirmPaymentTransfer: boolean;
}

/**
 * Deal-scoped Payments tab. The dossier rail does not repeat this.
 */
export default function WorkspacePaymentsTab({
    deal,
    canCreatePaymentRequest,
    canConfirmPaymentTransfer,
}: WorkspacePaymentsTabProps) {
    return (
        <DealPaymentPanel
            deal={deal}
            canCreatePaymentRequest={canCreatePaymentRequest}
            canConfirmPaymentTransfer={canConfirmPaymentTransfer}
        />
    );
}
