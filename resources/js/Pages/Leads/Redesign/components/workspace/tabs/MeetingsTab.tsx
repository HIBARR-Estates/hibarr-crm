import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    Button,
    EditMeetingModal,
    EmptyState,
    Icon,
    MeetingDetailModal,
    RescheduleMeetingModal,
    ScheduleMeetingModal,
} from "@/Components/Redesign";
import type { MeetingFormState } from "@/Components/Redesign/meeting/meetingFormUtils";
import {
    buildEmptyMeetingForm,
    buildMeetingFormFromFollowup,
    buildRescheduleFormFromFollowup,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import type { DealFollowup } from "@/Types/api/deal-followup";
import { toLeadMeetingPreview } from "../../../adapters/meetingAdapter";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadMeetingCreate from "../../../hooks/useLeadMeetingCreate";
import useLeadMeetingUpdate from "../../../hooks/useLeadMeetingUpdate";
import useLeadMeetingReschedule from "../../../hooks/useLeadMeetingReschedule";
import MeetingCard from "../cards/MeetingCard";

interface MeetingsTabProps {
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    /** Called when a meeting is created — parent may reload leadFollowUps or
     * patch context if the API ever returns the created follow-up payload. */
    onMeetingCreated?: () => void;
}

export default function MeetingsTab({
    meetingTypes,
    onMeetingCreated,
}: MeetingsTabProps) {
    const { td } = useTd();
    const { props } = usePage();
    const { lead, leadFollowUps, addLeadFollowUp } = useLeadWorkspace();
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [detailMeeting, setDetailMeeting] = useState<DealFollowup | null>(
        null,
    );
    const [rescheduleTargetId, setRescheduleTargetId] = useState<number | null>(
        null,
    );

    const {
        createMeeting,
        isCreating,
        errors: createErrors,
        clearErrors: clearCreateErrors,
    } = useLeadMeetingCreate(lead);
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
    } = useLeadMeetingReschedule(rescheduleTargetId);

    const meetings = useMemo(
        () => leadFollowUps.map(toLeadMeetingPreview),
        [leadFollowUps],
    );

    const scheduleInitialForm = useMemo(
        () => buildEmptyMeetingForm(null, props.auth?.user?.id),
        [props.auth?.user?.id],
    );

    const handleCreateSuccess = (payload?: DealFollowup) => {
        if (payload) {
            addLeadFollowUp(payload);
        } else {
            // follow_up_store returns null data today — parent reload may be needed.
            onMeetingCreated?.();
        }
        setScheduleOpen(false);
    };

    return (
        <div>
            <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-xs text-[#6b7280]">
                    {meetings.length} meeting{meetings.length === 1 ? "" : "s"}
                </span>
                <Button
                    variant="primary"
                    icon={<Icon name="plus" size={14} />}
                    onClick={() => {
                        clearCreateErrors();
                        setScheduleOpen(true);
                    }}
                >
                    {td("Schedule meeting")}
                </Button>
            </div>

            {meetings.length === 0 ? (
                <EmptyState
                    title={td("No meetings scheduled")}
                    description={td(
                        "Book a call or in-person meeting with this lead.",
                    )}
                />
            ) : (
                meetings.map((meeting) => {
                    const raw = leadFollowUps.find((m) => m.id === meeting.id);
                    return (
                        <MeetingCard
                            key={meeting.id}
                            meeting={meeting}
                            onClick={() => raw && setDetailMeeting(raw)}
                        />
                    );
                })
            )}

            <ScheduleMeetingModal
                open={scheduleOpen}
                onClose={() => setScheduleOpen(false)}
                saving={isCreating}
                errors={createErrors}
                meetingTypes={meetingTypes}
                initialForm={scheduleInitialForm}
                onSubmit={(form: MeetingFormState) =>
                    createMeeting(
                        {
                            meetingTypeId: form.meetingTypeId,
                            date: form.date,
                            startTime: form.startTime,
                            endTime: form.endTime,
                            duration: form.duration,
                            platform: form.platform,
                            meetingLink: form.meetingLink,
                            participants: form.participants,
                            remark: form.remark,
                            reminders: form.reminders,
                        },
                        () => handleCreateSuccess(),
                    )
                }
                labels={{
                    title: td("Schedule meeting"),
                    cancel: td("Cancel"),
                    submit: td("Schedule"),
                }}
            />

            <MeetingDetailModal
                meeting={detailMeeting}
                canEdit={Boolean(detailMeeting?.deal_id)}
                canDelete={false}
                onClose={() => setDetailMeeting(null)}
                isUpdating={isUpdating || isRescheduling}
                onCancelMeeting={() => {}}
                renderNestedModals={({
                    editOpen,
                    rescheduleOpen,
                    setEditOpen,
                    setRescheduleOpen,
                }) => {
                    if (!detailMeeting) return null;

                    return (
                        <>
                            <EditMeetingModal
                                open={editOpen}
                                onClose={() => setEditOpen(false)}
                                saving={isUpdating}
                                errors={updateErrors}
                                meetingTypes={meetingTypes}
                                initialForm={buildMeetingFormFromFollowup(
                                    detailMeeting,
                                    null,
                                    props.auth?.user?.id,
                                )}
                                onSubmit={(form) => {
                                    clearUpdateErrors();
                                    updateMeeting(
                                        detailMeeting.id,
                                        {
                                            meetingTypeId: form.meetingTypeId,
                                            date: form.date,
                                            startTime: form.startTime,
                                            endTime: form.endTime,
                                            duration: form.duration,
                                            platform: form.platform,
                                            meetingLink: form.meetingLink,
                                            participants: form.participants,
                                            remark: form.remark,
                                            reminders: form.reminders,
                                            dealId: detailMeeting.deal_id,
                                        },
                                        () => setEditOpen(false),
                                    );
                                }}
                                labels={{
                                    title: td("Edit meeting"),
                                    cancel: td("Cancel"),
                                    submit: td("Save"),
                                }}
                            />
                            <RescheduleMeetingModal
                                open={rescheduleOpen}
                                onClose={() => setRescheduleOpen(false)}
                                saving={isRescheduling}
                                errors={rescheduleErrors}
                                initialForm={buildRescheduleFormFromFollowup(
                                    detailMeeting,
                                )}
                                onSubmit={(form) => {
                                    clearRescheduleErrors();
                                    setRescheduleTargetId(detailMeeting.id);
                                    rescheduleMeeting(form, () =>
                                        setRescheduleOpen(false),
                                    );
                                }}
                                labels={{
                                    title: td("Reschedule meeting"),
                                    cancel: td("Cancel"),
                                    submit: td("Reschedule"),
                                    newDate: td("New date"),
                                    newStartTime: td("Start time"),
                                    duration: td("Duration"),
                                    hideDuration: td("Hide duration"),
                                    addDuration: td("Add duration"),
                                    endTime: td("End time"),
                                }}
                            />
                        </>
                    );
                }}
            />
        </div>
    );
}
