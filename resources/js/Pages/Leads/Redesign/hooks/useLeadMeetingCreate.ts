import { useCallback, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { message } from "antd";
import type { Lead } from "@/Types/api/leads";
import type { Reminder } from "@/Types/api/deal-followup";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import {
    getBrowserTimezone,
    persistUserTimezoneOnce,
} from "@/lib/userTimezone";
import type { MeetingPlatform } from "@/Pages/Deals/Redesign/components/workspace/meetingFormUtils";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
    isMeetingStartInFuture,
} from "@/Pages/Deals/Redesign/components/workspace/meetingFormUtils";

export interface LeadMeetingCreateInput {
    meetingTypeId: number | null;
    date: string;
    startTime: string;
    endTime: string;
    duration: number | null;
    platform: MeetingPlatform;
    meetingLink: string;
    participants: number[];
    remark: string;
    reminders: Reminder[];
    dealId?: number | null;
}

interface FollowUpStorePayload {
    lead_id: number;
    deal_id?: number;
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    duration?: number | null;
    reminders: Reminder[];
    remark?: string;
    timezone?: string;
    participants?: number[];
}

export default function useLeadMeetingCreate(lead: Lead) {
    const [errors, setErrors] = useState<string[]>([]);
    const { props } = usePage<{
        auth?: { user?: { timezone?: string | null } | null };
    }>();

    const { mutate, status } = useApiMutate<
        FollowUpStorePayload,
        null,
        ApiResponse<null>
    >(route("deals.follow_up_store"), "POST");

    const createMeeting = useCallback(
        (input: LeadMeetingCreateInput, onSuccess?: () => void) => {
            const validationErrors: string[] = [];

            if (!lead.lead_owner?.id && !input.dealId) {
                validationErrors.push(
                    "This lead has no owner assigned. Assign an owner or link a deal before booking a meeting.",
                );
            }

            if (!input.meetingTypeId) {
                validationErrors.push("Please select a meeting type.");
            }

            if (!input.date) {
                validationErrors.push("Please select a meeting date.");
            }

            if (!input.startTime) {
                validationErrors.push("Please select a start time.");
            } else if (
                input.date &&
                !isMeetingStartInFuture(input.date, input.startTime)
            ) {
                validationErrors.push(
                    "Start time must be at least 5 minutes in the future.",
                );
            }

            if (!input.platform) {
                validationErrors.push("Please select a platform.");
            }

            if (
                input.platform === "zoho" &&
                input.participants.length === 0
            ) {
                validationErrors.push(
                    "At least one participant is required for video meetings.",
                );
            }

            if (validationErrors.length > 0) {
                setErrors(validationErrors);
                return;
            }

            persistUserTimezoneOnce(props.auth?.user?.timezone);

            const payload: FollowUpStorePayload = {
                lead_id: lead.id,
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

            if (input.dealId) {
                payload.deal_id = input.dealId;
            }

            setErrors([]);
            mutate(payload, {
                onSuccess: () => {
                    setErrors([]);
                    message.success("Meeting scheduled");
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
                            : [
                                  formatted.message ||
                                      "Failed to schedule meeting",
                              ],
                    );
                },
            });
        },
        [lead, mutate, props.auth?.user?.timezone],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createMeeting,
        isCreating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
