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
// Pure function only — the default export of that module is a hook bound to
// LeadWorkspaceContext, which the Meetings index has no business mounting.
import { validateMeetingForm } from "@/Pages/Leads/Redesign/hooks/useLeadMeetingCreate";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { ScheduleRecordType } from "./useScheduleRecordSource";

interface FollowUpStorePayload {
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
    host_id?: number | null;
}

export interface ScheduleTarget {
    type: ScheduleRecordType;
    id: number;
    /** Deal agent / lead owner, when the record has one. */
    hasOwner: boolean;
}

/**
 * Meeting create for the Meetings index, where the deal *or* lead is picked in
 * the dialog itself. No workspace context here (those only wrap the detail
 * pages), so the caller reloads the list on success instead of patching one.
 */
export default function useMeetingsScheduleCreate() {
    const [errors, setErrors] = useState<string[]>([]);
    const { props } = usePage();

    const { mutate, status } = useApiMutate<
        FollowUpStorePayload,
        DealFollowup,
        ApiResponse<DealFollowup>
    >(route("deals.follow_up_store"), "POST");

    const createMeeting = useCallback(
        (
            form: MeetingFormState,
            target: ScheduleTarget | null,
            onSuccess?: () => void,
        ) => {
            if (!target) {
                setErrors(["Please select the deal or lead to book against."]);
                return;
            }

            const validationErrors = validateMeetingForm(form, {
                // A deal without an agent, or a lead without an owner, has
                // nobody accountable for the meeting — the backend rejects it.
                hasOwnerOrDeal: target.type === "deal" || target.hasOwner,
                userEmail: props.auth?.user?.email,
            });

            if (validationErrors.length > 0) {
                setErrors(validationErrors);
                return;
            }

            persistUserTimezoneOnce(
                props.auth?.user?.timezone,
                props.auth?.user?.timezone_locked,
            );

            const payload: FollowUpStorePayload = {
                [target.type === "deal" ? "deal_id" : "lead_id"]: target.id,
                next_follow_up_date: formatMeetingDateForApi(form.date),
                start_time: formatMeetingTimeForApi(form.startTime),
                meeting_type_id: form.meetingTypeId ?? undefined,
                location: locationForPayload(form.platform, form.locationDetail),
                meeting_link: meetingLinkForPayload(
                    form.platform,
                    form.meetingLink,
                ),
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
                    // follow_up_store can answer HTTP 200 with a soft
                    // {status:'fail'} body (e.g. an automation error) — without
                    // this the dialog would close as if the meeting was saved.
                    if (!isSuccessResponse(response)) {
                        setErrors([
                            ("message" in response && response.message) ||
                                "Failed to schedule meeting",
                        ]);
                        return;
                    }
                    setErrors([]);
                    onSuccess?.();
                },
                onError: (errorResponse) => {
                    const formatted = errorFormatter(errorResponse);
                    const responseErrors = Object.values(
                        formatted.errors || {},
                    ).flat() as string[];
                    setErrors(
                        responseErrors.length > 0
                            ? responseErrors
                            : [
                                  formatted.message ||
                                      "Failed to schedule meeting",
                              ],
                    );
                },
            });
        },
        [mutate, props.auth?.user?.email, props.auth?.user?.timezone],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createMeeting,
        isCreating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
