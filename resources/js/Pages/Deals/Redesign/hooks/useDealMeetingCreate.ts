import { useCallback, useState } from "react";
import { message } from "antd";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup, Reminder } from "@/Types/api/deal-followup";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";
import type { MeetingPlatform } from "../components/workspace/meetingFormUtils";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
    isMeetingStartInFuture,
} from "../components/workspace/meetingFormUtils";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export interface DealMeetingCreateInput {
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
}

interface FollowUpStorePayload {
    deal_id: number;
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

function dealHasAgent(deal: Deal): boolean {
    return (
        deal.agent_id != null ||
        (deal.lead_agent != null && deal.lead_agent.id != null)
    );
}

export default function useDealMeetingCreate(deal: Deal) {
    const { t } = useTranslation();
    const [errors, setErrors] = useState<string[]>([]);
    const { setDealFollowUps } = useDealWorkspace();

    const { mutate, status } = useApiMutate<
        FollowUpStorePayload,
        DealFollowup,
        ApiResponse<DealFollowup>
    >(route("deals.follow_up_store"), "POST");

    const createMeeting = useCallback(
        (input: DealMeetingCreateInput, onSuccess?: () => void) => {
            const validationErrors: string[] = [];

            if (!dealHasAgent(deal)) {
                validationErrors.push(
                    "This deal has no agent assigned. Please assign an agent before booking a meeting.",
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

            const payload: FollowUpStorePayload = {
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
                onSuccess: (response) => {
                    setErrors([]);
                    message.success(t("pages.deals.workspace.meetings.messages.scheduled"));
                    if (response?.data) {
                        const created = response.data;
                        setDealFollowUps((prev) => [created, ...prev]);
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
                            : [formatted.message || "Failed to schedule meeting"],
                    );
                },
            });
        },
        [deal, mutate, setDealFollowUps, t],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createMeeting,
        isCreating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
