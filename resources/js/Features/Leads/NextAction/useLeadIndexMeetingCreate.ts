import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
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
// Pure function only — does not touch LeadWorkspaceContext (the default
// export `useLeadMeetingCreate` hook does, which is why this file can't use
// that hook directly on the context-free Leads index).
import { validateMeetingForm } from "@/Pages/Leads/Redesign/hooks/useLeadMeetingCreate";
import type { DealFollowup } from "@/Types/api/deal-followup";

interface FollowUpStorePayload {
    lead_id: number;
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
    host_id?: number | null;
}

/**
 * Meeting create for the Leads *index* — no LeadWorkspaceContext (that only
 * wraps the single-lead detail page), so no soft-duplicate check against a
 * preloaded meeting list and no local list patch. Caller reloads the "leads"
 * prop on success instead.
 *
 * ponytail: skips useLeadMeetingCreate's duplicate-meeting warning — that
 * needs each lead's existing meetings preloaded, which the index deliberately
 * doesn't fetch per row. Add if duplicate bookings from this entry point turn
 * out to be a real problem.
 */
export default function useLeadIndexMeetingCreate(
    leadId: number,
    leadOwnerId?: number | null,
) {
    const [errors, setErrors] = useState<string[]>([]);
    const { props } = usePage();

    const { mutate, status } = useApiMutate<
        FollowUpStorePayload,
        DealFollowup,
        ApiResponse<DealFollowup>
    >(route("deals.follow_up_store"), "POST");

    const createMeeting = useCallback(
        (form: MeetingFormState, onSuccess?: () => void) => {
            const validationErrors = validateMeetingForm(
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
                },
                {
                    hasOwnerOrDeal: Boolean(leadOwnerId),
                    userEmail: props.auth?.user?.email,
                },
            );

            if (validationErrors.length > 0) {
                setErrors(validationErrors);
                return;
            }

            persistUserTimezoneOnce(props.auth?.user?.timezone, props.auth?.user?.timezone_locked);

            const payload: FollowUpStorePayload = {
                lead_id: leadId,
                next_follow_up_date: formatMeetingDateForApi(form.date),
                start_time: formatMeetingTimeForApi(form.startTime),
                meeting_type_id: form.meetingTypeId ?? undefined,
                location: locationForPayload(form.platform, form.locationDetail),
                meeting_link: meetingLinkForPayload(form.platform, form.meetingLink),
                duration: form.duration,
                reminders: form.reminders,
                remark: form.remark.trim(),
                participants: form.participants,
                host_id: form.hostId,
                timezone: getBrowserTimezone(),
            };

            setErrors([]);
            mutate(payload, {
                onSuccess: (response) => {
                    // deals.follow_up_store can answer HTTP 200 with a soft
                    // {status:'fail', ...} body (e.g. automation errors) —
                    // without this check the modal closed and the table
                    // "refreshed" as if the meeting had actually been saved.
                    if (!isSuccessResponse(response)) {
                        const message =
                            "message" in response && response.message
                                ? response.message
                                : "Failed to schedule meeting";
                        setErrors([message]);
                        return;
                    }
                    setErrors([]);
                    onSuccess?.();
                },
                onError: (errorResponse) => {
                    const formatted = errorFormatter(errorResponse);
                    const responseErrors = Object.values(
                        formatted.errors || {},
                    ).flat();
                    setErrors(
                        responseErrors.length > 0
                            ? responseErrors
                            : [formatted.message || "Failed to schedule meeting"],
                    );
                },
            });
        },
        [leadId, leadOwnerId, mutate, props.auth?.user?.email, props.auth?.user?.timezone],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createMeeting,
        isCreating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
