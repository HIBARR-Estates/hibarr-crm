import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import { message } from "antd";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Lead } from "@/Types/api/leads";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import {
    getBrowserTimezone,
    persistUserTimezoneOnce,
} from "@/lib/userTimezone";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import type { LeadMeetingCreateInput } from "./useLeadMeetingCreate";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

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
    status?: string;
}

export default function useLeadMeetingUpdate(lead: Lead) {
    const [errors, setErrors] = useState<string[]>([]);
    const { props } = usePage();
    const { setLeadFollowUps } = useLeadWorkspace();

    const { mutate, status } = useApiMutate<
        FollowUpUpdatePayload,
        DealFollowup,
        ApiResponse<DealFollowup>
    >(route("deals.follow_up_update"), "POST");

    const updateMeeting = useCallback(
        (
            followupId: number,
            input: LeadMeetingCreateInput & { dealId?: number | null },
            onSuccess?: () => void,
            statusOverride?: string,
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
                status: statusOverride,
            };

            setErrors([]);
            mutate(payload, {
                onSuccess: (response) => {
                    setErrors([]);
                    message.success(
                        statusOverride === "cancelled"
                            ? "Meeting cancelled"
                            : "Meeting updated",
                    );
                    if (response?.data) {
                        const updated = response.data;
                        setLeadFollowUps((prev) =>
                            prev.map((item) =>
                                item.id === updated.id ? updated : item,
                            ),
                        );
                    }
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
                            : [formatted.message || "Failed to update meeting"],
                    );
                },
            });
        },
        [lead.id, mutate, props.auth?.user?.timezone, setLeadFollowUps],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        updateMeeting,
        isUpdating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
