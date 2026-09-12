import { usePage } from "@inertiajs/react";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import MeetingDetailModal from "@/Components/Redesign/modals/MeetingDetailModal";
import MeetingViewModal from "@/Components/Redesign/modals/MeetingViewModal";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealMeetingUpdate from "../../hooks/useDealMeetingUpdate";
import DealEditMeetingModal from "./DealEditMeetingModal";
import DealRescheduleMeetingModal from "./DealRescheduleMeetingModal";
import { buildMeetingFormFromFollowup } from "./meetingFormUtils";

interface DealMeetingDetailModalProps {
    meeting: DealFollowup | null;
    deal: Deal;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    canEdit: boolean;
    canDelete: boolean;
    onClose: () => void;
    /** Open compact viewer on the Summary tab. */
    initialPanel?: "info" | "summary";
}

export default function DealMeetingDetailModal({
    meeting: meetingProp,
    deal,
    meetingTypes,
    canEdit,
    canDelete,
    onClose,
    initialPanel = "info",
}: DealMeetingDetailModalProps) {
    const { setDealFollowUps, dealFollowUps } = useDealWorkspace();
    const meeting =
        meetingProp == null
            ? null
            : (dealFollowUps.find((item) => item.id === meetingProp.id) ??
              meetingProp);
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const { updateMeeting, isUpdating } = useDealMeetingUpdate(deal);

    const handleCancelMeeting = () => {
        if (!meeting) return;
        const form = buildMeetingFormFromFollowup(
            meeting,
            deal,
            currentUserId,
        );
        updateMeeting(
            meeting.id,
            form,
            () => {
                onClose();
            },
            "cancelled",
        );
    };

    const nested = ({
        editOpen,
        rescheduleOpen,
        deleteOpen,
        setEditOpen,
        setRescheduleOpen,
        setDeleteOpen,
    }: {
        editOpen: boolean;
        rescheduleOpen: boolean;
        deleteOpen: boolean;
        setEditOpen: (open: boolean) => void;
        setRescheduleOpen: (open: boolean) => void;
        setDeleteOpen: (open: boolean) => void;
    }) =>
        meeting ? (
            <>
                <DealEditMeetingModal
                    open={editOpen}
                    onClose={() => setEditOpen(false)}
                    deal={deal}
                    followup={meeting}
                    meetingTypes={meetingTypes}
                />
                <DealRescheduleMeetingModal
                    open={rescheduleOpen}
                    onClose={() => setRescheduleOpen(false)}
                    followup={meeting}
                />
                <DeleteFollowup
                    open={deleteOpen}
                    onClose={() => {
                        setDeleteOpen(false);
                        onClose();
                    }}
                    followup={meeting}
                    skipReload
                    onDeleted={(followupId) => {
                        setDealFollowUps((prev) =>
                            prev.filter((f) => f.id !== followupId),
                        );
                    }}
                />
            </>
        ) : null;

    return (
        <MeetingViewModal
            meeting={meeting}
            canEdit={canEdit}
            canDelete={canDelete}
            onClose={onClose}
            isUpdating={isUpdating}
            onCancelMeeting={handleCancelMeeting}
            includeSummary
            userId={currentUserId}
            initialPanel={initialPanel}
            renderNestedModals={nested}
            fallback={
                <MeetingDetailModal
                    meeting={meeting}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onClose={onClose}
                    isUpdating={isUpdating}
                    onCancelMeeting={handleCancelMeeting}
                    renderNestedModals={({
                        editOpen,
                        rescheduleOpen,
                        deleteOpen,
                        summaryOpen,
                        setEditOpen,
                        setRescheduleOpen,
                        setDeleteOpen,
                        setSummaryOpen,
                    }) =>
                        meeting ? (
                            <>
                                {summaryOpen && (
                                    <ViewFollowup
                                        open={summaryOpen}
                                        onClose={() => setSummaryOpen(false)}
                                        followup={meeting}
                                        deal={deal}
                                    />
                                )}
                                <DealEditMeetingModal
                                    open={editOpen}
                                    onClose={() => setEditOpen(false)}
                                    deal={deal}
                                    followup={meeting}
                                    meetingTypes={meetingTypes}
                                />
                                <DealRescheduleMeetingModal
                                    open={rescheduleOpen}
                                    onClose={() => setRescheduleOpen(false)}
                                    followup={meeting}
                                />
                                <DeleteFollowup
                                    open={deleteOpen}
                                    onClose={() => {
                                        setDeleteOpen(false);
                                        onClose();
                                    }}
                                    followup={meeting}
                                    skipReload
                                    onDeleted={(followupId) => {
                                        setDealFollowUps((prev) =>
                                            prev.filter(
                                                (f) => f.id !== followupId,
                                            ),
                                        );
                                    }}
                                />
                            </>
                        ) : null
                    }
                />
            }
        />
    );
}
