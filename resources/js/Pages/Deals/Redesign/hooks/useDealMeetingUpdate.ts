import { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import type { Deal } from "@/Types/api/deals";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import type { DealMeetingCreateInput } from "../../hooks/useDealMeetingCreate";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
} from "../components/workspace/meetingFormUtils";

interface FollowUpUpdatePayload {
    id: number;
    deal_id: number;
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    duration?: number | null;
    reminders: DealMeetingCreateInput["reminders"];
    remark?: string;
    timezone?: string;
    participants?: number[];
}

export default function useDealMeetingUpdate(deal: Deal) {
    const [errors, setErrors] = useState<string[]>([]);

    const { mutate, status } = useApiMutate<
        FollowUpUpdatePayload,
        null,
        ApiResponse<null>
    >(route("deals.follow_up_update"), "POST");

    const updateMeeting = useCallback(
        (
            followupId: number,
            input: DealMeetingCreateInput,
            onSuccess?: () => void,
        ) => {
            const payload: FollowUpUpdatePayload = {
                id: followupId,
                deal_id: deal.id,
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
                timezone:
                    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            };

            setErrors([]);
            mutate(payload, {
                onSuccess: () => {
                    setErrors([]);
                    message.success("Meeting updated");
                    onSuccess?.();
                    router.reload({ only: ["dealFollowUps"] });
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
        [deal.id, mutate],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        updateMeeting,
        isUpdating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
