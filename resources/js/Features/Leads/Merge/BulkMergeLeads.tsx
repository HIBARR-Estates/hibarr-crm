import { Alert, Modal } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { IModalProps } from "@/Types/common";
import LeadMergeReviewModal from "./LeadMergeReviewModal";

interface Props extends IModalProps {
    ids: number[];
}

/**
 * Manual "pick any two leads" merge entry (HIB-1120 AC): wraps the review
 * modal for the Leads/Index.tsx bulk-selection flow. Row order in the table
 * decides which of the two selected leads is treated as primary (A).
 */
export default function BulkMergeLeads({ ids, open, onClose }: Props) {
    const { td } = useTd();

    if (ids.length !== 2) {
        return (
            <Modal
                open={open}
                onCancel={() => onClose()}
                footer={null}
                title={td("Merge leads")}
            >
                <Alert
                    type="info"
                    showIcon
                    message={td("Select exactly two leads to merge.")}
                />
            </Modal>
        );
    }

    return (
        <LeadMergeReviewModal
            open={open}
            primaryId={ids[0]}
            duplicateId={ids[1]}
            onClose={onClose}
        />
    );
}
