import { useState } from "react";
import { Modal, List, Button, Empty, Skeleton } from "antd";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { IModalProps } from "@/Types/common";
import type { LeadDuplicateCandidate } from "@/Types/api/lead-merge";
import LeadMergeReviewModal from "./LeadMergeReviewModal";

interface DuplicatesResponse {
    status: "success";
    message: string;
    duplicates: LeadDuplicateCandidate[];
}

interface Props extends IModalProps {
    leadId: number;
    leadName?: string | null;
}

/**
 * Find Duplicates entry point (HIB-1120 AC): lists candidates for one lead,
 * selecting a candidate opens the merge review screen directly for that pair.
 */
export default function FindDuplicatesModal({
    open,
    onClose,
    leadId,
    leadName,
}: Props) {
    const { td } = useTd();
    const [reviewCandidateId, setReviewCandidateId] = useState<number | null>(
        null,
    );

    const { data, isLoading } = useApiQuery<DuplicatesResponse>({
        path: route("lead-contact.duplicates", leadId),
        options: { enabled: open },
    });

    const candidates = data?.duplicates ?? [];

    const handleClose = () => {
        setReviewCandidateId(null);
        onClose();
    };

    return (
        <>
            <Modal
                open={open && reviewCandidateId === null}
                onCancel={handleClose}
                title={`${td("Find duplicates for", { source: "en" })} ${leadName ?? td("this lead", { source: "en" })}`}
                footer={null}
            >
                {isLoading && <Skeleton active />}
                {!isLoading && candidates.length === 0 && (
                    <Empty description={td("No potential duplicates found.", { source: "en" })} />
                )}
                {!isLoading && candidates.length > 0 && (
                    <List
                        dataSource={candidates}
                        renderItem={(candidate) => (
                            <List.Item
                                actions={[
                                    <Button
                                        key="review"
                                        type="primary"
                                        size="small"
                                        onClick={() =>
                                            setReviewCandidateId(candidate.id)
                                        }
                                    >
                                        {td("Review merge", { source: "en" })}
                                    </Button>,
                                ]}
                            >
                                <List.Item.Meta
                                    title={candidate.client_name}
                                    description={[
                                        candidate.client_email,
                                        candidate.mobile,
                                        candidate.company_name,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                />
                            </List.Item>
                        )}
                    />
                )}
            </Modal>

            {reviewCandidateId !== null && (
                <LeadMergeReviewModal
                    open={open}
                    primaryId={leadId}
                    duplicateId={reviewCandidateId}
                    onClose={(merged) => {
                        setReviewCandidateId(null);
                        onClose(merged);
                    }}
                />
            )}
        </>
    );
}
