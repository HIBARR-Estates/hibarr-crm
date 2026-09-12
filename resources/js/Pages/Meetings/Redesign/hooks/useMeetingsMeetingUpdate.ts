import { useCallback, useState } from "react";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import {
    getBrowserTimezone,
    persistUserTimezoneOnce,
} from "@/lib/userTimezone";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
    locationForPayload,
    meetingLinkForPayload,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import type { DealFollowup } from "@/Types/api/deal-followup";

interface FollowUpUpdatePayload {
    id: number;
    deal_id?: number;
    lead_id?: number;
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    duration?: number | null;
    reminders: MeetingFormState["reminders"];
    remark?: string;
    timezone?: string;
    participants?: number[];
}

/**
 * Saves an edited meeting from the Meetings index.
 *
 * Same `deals.follow_up_update` endpoint the deal and lead workspaces post
 * to; the difference is only where the record ids come from. Those pages read
 * them from the deal/lead they are already showing and patch their workspace
 * context from the response — this page has neither, so it hands the updated
 * meeting back to the caller and lets the list re-read itself.
 */
export default function useMeetingsMeetingUpdate() {
    const [errors, setErrors] = useState<string[]>([]);
    const { props } = usePage();

    const { mutate, status } = useApiMutate<
        FollowUpUpdatePayload,
        DealFollowup,
        ApiResponse<DealFollowup>
    >(route("deals.follow_up_update"), "POST");

    const updateMeeting = useCallback(
        (
            meeting: DealFollowup,
            form: MeetingFormState,
            onSuccess?: (updated: DealFollowup) => void,
        ) => {
            const dealId = meeting.deal?.id ?? meeting.deal_id ?? undefined;
            const leadId = meeting.lead?.id ?? meeting.lead_id ?? undefined;

            // The endpoint writes through the deal; a lead-only meeting has
            // nothing to write through, which is the same limit the lead
            // workspace reports rather than failing silently in the backend.
            if (!dealId) {
                setErrors([
                    "This meeting must be linked to a deal before it can be edited.",
                ]);
                return;
            }

            persistUserTimezoneOnce(
                props.auth?.user?.timezone,
                props.auth?.user?.timezone_locked,
            );

            const payload: FollowUpUpdatePayload = {
                id: meeting.id,
                deal_id: dealId,
                lead_id: leadId,
                next_follow_up_date: formatMeetingDateForApi(form.date),
                start_time: formatMeetingTimeForApi(form.startTime),
                meeting_type_id: form.meetingTypeId ?? undefined,
                location: locationForPayload(
                    form.platform,
                    form.locationDetail,
                ),
                meeting_link: meetingLinkForPayload(
                    form.platform,
                    form.meetingLink,
                ),
                duration: form.duration,
                reminders: form.reminders,
                remark: form.remark.trim(),
                participants: form.participants,
                // The zone the form's wall clock is in (the meeting's stored
                // one); browser-local only for legacy rows without one.
                timezone: form.timezone || getBrowserTimezone(),
            };

            setErrors([]);
            mutate(payload, {
                onSuccess: (response) => {
                    setErrors([]);
                    message.success("Meeting updated");
                    onSuccess?.(response.data as DealFollowup);
                },
                onError: (error) => {
                    setErrors([
                        errorFormatter(error).message ||
                            "Failed to update meeting",
                    ]);
                },
            });
        },
        [mutate, props.auth?.user?.timezone, props.auth?.user?.timezone_locked],
    );

    return {
        updateMeeting,
        isUpdating: isLoading({ status }),
        errors,
        clearErrors: useCallback(() => setErrors([]), []),
    };
}
