import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import { message } from "antd";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import {
    getBrowserTimezone,
    persistUserTimezoneOnce,
} from "@/lib/userTimezone";
import useTranslation from "@/Hooks/useTranslation";
import type { DealMeetingCreateInput } from "./useDealMeetingCreate";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
    locationForPayload,
    meetingLinkForPayload,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

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
    status?: string;
}

export default function useDealMeetingUpdate(deal: Deal) {
    const { t } = useTranslation();
    const [errors, setErrors] = useState<string[]>([]);
    const { setDealFollowUps } = useDealWorkspace();
    const { props } = usePage();

    const { mutate, status } = useApiMutate<
        FollowUpUpdatePayload,
        DealFollowup,
        ApiResponse<DealFollowup>
    >(route("deals.follow_up_update"), "POST");

    const updateMeeting = useCallback(
        (
            followupId: number,
            input: DealMeetingCreateInput,
            onSuccess?: () => void,
            statusOverride?: string,
        ) => {
            persistUserTimezoneOnce(props.auth?.user?.timezone);

            const payload: FollowUpUpdatePayload = {
                id: followupId,
                deal_id: deal.id,
                next_follow_up_date: formatMeetingDateForApi(input.date),
                start_time: formatMeetingTimeForApi(input.startTime),
                meeting_type_id: input.meetingTypeId ?? undefined,
                location: locationForPayload(
                    input.platform,
                    input.locationDetail,
                ),
                meeting_link: meetingLinkForPayload(
                    input.platform,
                    input.meetingLink,
                ),
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
                    message.success(t("pages.deals.workspace.meetings.messages.updated"));
                    if (response?.data) {
                        const updated = response.data;
                        setDealFollowUps((prev) =>
                            prev.map((f) => (f.id === updated.id ? updated : f)),
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
                            : [formatted.message || t("pages.deals.workspace.meetings.messages.update_failed")],
                    );
                },
            });
        },
        [deal.id, mutate, props.auth?.user?.timezone, setDealFollowUps, t],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        updateMeeting,
        isUpdating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
