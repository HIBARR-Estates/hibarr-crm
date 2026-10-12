import type { Deal } from "@/Types/api/deals";
import DealPaymentPanel from "./DealPaymentPanel";

interface WorkspacePaymentsTabProps {
    deal: Deal;
    canCreatePaymentRequest: boolean;
    canConfirmPaymentTransfer: boolean;
}

/**
 * Deal-scoped Payments tab — same create / confirm / history UI as the
 * dossier rail Payment section, given primary-tab discoverability.
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
