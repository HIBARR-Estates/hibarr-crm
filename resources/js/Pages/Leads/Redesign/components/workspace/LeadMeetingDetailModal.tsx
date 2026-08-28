import { usePage } from "@inertiajs/react";
import type { DealFollowup } from "@/Types/api/deal-followup";
import {
    EditMeetingModal,
    MeetingDetailModal,
    RescheduleMeetingModal,
} from "@/Components/Redesign";
import {
    buildMeetingFormFromFollowup,
    buildRescheduleFormFromFollowup,
    getMeetingOwner,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import ViewFollowup from "@/Pages/Deals/Components/Tabs/followups/ViewFollowup";
import useLeadMeetingUpdate from "../../hooks/useLeadMeetingUpdate";
import useLeadMeetingReschedule from "../../hooks/useLeadMeetingReschedule";
import { useLeadWorkspace } from "../../context/LeadWorkspaceContext";

interface LeadMeetingDetailModalProps {
    meeting: DealFollowup | null;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    permissions?: Record<string, string>;
    onClose: () => void;
}

function canEditMeeting(
    followup: DealFollowup,
    permissions: Record<string, string> | undefined,
    userId: number | undefined,
): boolean {
    if (!permissions) return Boolean(followup.deal_id);
    if (permissions.edit_lead_follow_up === "none") return false;
    if (!followup.deal_id) return false;
    return (
        permissions.edit_lead_follow_up === "all" ||
        (permissions.edit_lead_follow_up === "added" &&
            followup.added_by?.id === userId)
    );
}

function canDeleteMeeting(
    followup: DealFollowup,
    permissions: Record<string, string> | undefined,
    userId: number | undefined,
): boolean {
    if (!permissions) return true;
    if (permissions.delete_lead_follow_up === "all") return true;
    if (permissions.delete_lead_follow_up === "added") {
        return followup.added_by?.id === userId;
    }
    return false;
}

export default function LeadMeetingDetailModal({
    meeting: meetingProp,
    meetingTypes,
    permissions,
    onClose,
}: LeadMeetingDetailModalProps) {
    const { td } = useTd();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const { lead, deals, setLeadFollowUps, leadFollowUps } = useLeadWorkspace();
    // Keep the open meeting in sync with workspace patches (e.g. reschedule).
    const meeting =
        meetingProp == null
            ? null
            : (leadFollowUps.find((item) => item.id === meetingProp.id) ??
              meetingProp);
    const {
        updateMeeting,
        isUpdating,
        errors: updateErrors,
        clearErrors: clearUpdateErrors,
    } = useLeadMeetingUpdate(lead);
    const {
        rescheduleMeeting,
        isRescheduling,
        errors: rescheduleErrors,
        clearErrors: clearRescheduleErrors,
    } = useLeadMeetingReschedule(meeting?.id ?? null);

    const canEdit = meeting
        ? canEditMeeting(meeting, permissions, userId)
        : false;
    const canDelete = meeting
        ? canDeleteMeeting(meeting, permissions, userId)
        : false;

    const linkedDeal =
        meeting?.deal_id != null
            ? deals.find((deal) => deal.id === meeting.deal_id) ?? null
            : null;
    const mustIncludeOwner = getMeetingOwner(linkedDeal ?? lead);

    const handleCancelMeeting = () => {
        if (!meeting?.deal_id) return;
        const form = buildMeetingFormFromFollowup(meeting, null, userId);
        updateMeeting(
            meeting.id,
            {
                meetingTypeId: form.meetingTypeId,
                date: form.date,
                startTime: form.startTime,
                endTime: form.endTime,
                duration: form.duration,
                platform: form.platform,
                locationDetail: form.locationDetail,
                meetingLink: form.meetingLink,
                participants: form.participants,
                hostId: form.hostId,
                remark: form.remark,
                reminders: form.reminders,
                dealId: meeting.deal_id,
            },
            () => onClose(),
            "cancelled",
        );
    };

    return (
        <MeetingDetailModal
            meeting={meeting}
            canEdit={canEdit}
            canDelete={canDelete}
            onClose={onClose}
            isUpdating={isUpdating || isRescheduling}
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
            }) => {
                if (!meeting) return null;

                return (
                    <>
                        {summaryOpen && linkedDeal && (
                            <ViewFollowup
                                open={summaryOpen}
                                onClose={() => setSummaryOpen(false)}
                                followup={meeting}
                                deal={linkedDeal}
                            />
                        )}
                        <EditMeetingModal
                            open={editOpen}
                            onClose={() => setEditOpen(false)}
                            saving={isUpdating}
                            errors={updateErrors}
                            meetingTypes={meetingTypes}
                            initialForm={buildMeetingFormFromFollowup(
                                meeting,
                                null,
                                userId,
                            )}
                            onSubmit={(form) => {
                                clearUpdateErrors();
                                updateMeeting(
                                    meeting.id,
                                    {
                                        meetingTypeId: form.meetingTypeId,
                                        date: form.date,
                                        startTime: form.startTime,
                                        endTime: form.endTime,
                                        duration: form.duration,
                                        platform: form.platform,
                                        locationDetail: form.locationDetail,
                                        meetingLink: form.meetingLink,
                                        participants: form.participants,
                                        hostId: form.hostId,
                                        remark: form.remark,
                                        reminders: form.reminders,
                                        dealId: meeting.deal_id,
                                    },
                                    () => setEditOpen(false),
                                );
                            }}
                            mustIncludeOwner={mustIncludeOwner}
                            labels={{
                                title: td("Edit meeting", { source: "en" }),
                                cancel: td("Cancel", { source: "en" }),
                                submit: td("Save", { source: "en" }),
                            }}
                        />
                        <RescheduleMeetingModal
                            open={rescheduleOpen}
                            onClose={() => setRescheduleOpen(false)}
                            saving={isRescheduling}
                            errors={rescheduleErrors}
                            initialForm={buildRescheduleFormFromFollowup(
                                meeting,
                            )}
                            onSubmit={(form) => {
                                clearRescheduleErrors();
                                rescheduleMeeting(form, () =>
                                    setRescheduleOpen(false),
                                );
                            }}
                            labels={{
                                title: td("Reschedule meeting", { source: "en" }),
                                cancel: td("Cancel", { source: "en" }),
                                submit: td("Reschedule", { source: "en" }),
                                newDate: td("New date", { source: "en" }),
                                newStartTime: td("Start time", { source: "en" }),
                                duration: td("Duration", { source: "en" }),
                                hideDuration: td("Hide duration", { source: "en" }),
                                addDuration: td("Add duration", { source: "en" }),
                                endTime: td("End time", { source: "en" }),
                            }}
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
                                setLeadFollowUps((prev) =>
                                    prev.filter((item) => item.id !== followupId),
                                );
                            }}
                        />
                    </>
                );
            }}
        />
    );
}
