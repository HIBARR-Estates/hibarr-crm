import { useCallback, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { message } from "antd";
import type { Lead } from "@/Types/api/leads";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import {
    getBrowserTimezone,
    persistUserTimezoneOnce,
} from "@/lib/userTimezone";
import type { LeadMeetingCreateInput } from "./useLeadMeetingCreate";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
} from "@/Pages/Deals/Redesign/components/workspace/meetingFormUtils";

interface FollowUpUpdatePayload {
    id: number;
    lead_id: number;
    deal_id?: number;
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    duration?: number | null;
    reminders: LeadMeetingCreateInput["reminders"];
    remark?: string;
    timezone?: string;
    participants?: number[];
}

export default function useLeadMeetingUpdate(lead: Lead) {
    const [errors, setErrors] = useState<string[]>([]);
    const { props } = usePage<{
        auth?: { user?: { timezone?: string | null } | null };
    }>();

    const { mutate, status } = useApiMutate<
        FollowUpUpdatePayload,
        null,
        ApiResponse<null>
    >(route("deals.follow_up_update"), "POST");

    const updateMeeting = useCallback(
        (
            followupId: number,
            input: LeadMeetingCreateInput & { dealId?: number | null },
            onSuccess?: () => void,
        ) => {
            if (!input.dealId) {
                setErrors([
                    "This meeting must be linked to a deal before it can be edited.",
                ]);
                return;
            }

            persistUserTimezoneOnce(props.auth?.user?.timezone);

            const payload: FollowUpUpdatePayload = {
                id: followupId,
                lead_id: lead.id,
                deal_id: input.dealId,
                next_follow_up_date: formatMeetingDateForApi(input.date),
                start_time: formatMeetingTimeForApi(input.startTime),
                meeting_type_id: input.meetingTypeId ?? undefined,
                location: input.platform,
                meeting_link:
                    input.platform === "zoho" ? input.meetingLink.trim() : "",
                duration: input.duration,
                reminders: input.reminders,
                remark: input.remark.trim(),
                participants: input.participants,
                timezone: getBrowserTimezone(),
            };

            setErrors([]);
            mutate(payload, {
                onSuccess: () => {
                    setErrors([]);
                    message.success("Meeting updated");
                    onSuccess?.();
                    router.reload({ only: ["leadFollowUps"] });
                },
                onError: (errorResponse) => {
                    const formatted = errorFormatter(errorResponse);
                    const responseErrors = Object.values(
                        formatted.errors || {},
                    ).flat();
                    setErrors(
                        responseErrors.length > 0
                            ? responseErrors
                            : [formatted.message || "Failed to update meeting"],
                    );
                },
            });
        },
        [lead.id, mutate, props.auth?.user?.timezone],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        updateMeeting,
        isUpdating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
