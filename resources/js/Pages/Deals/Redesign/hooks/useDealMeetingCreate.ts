import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import { message } from "antd";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup, Reminder } from "@/Types/api/deal-followup";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import {
    getBrowserTimezone,
    persistUserTimezoneOnce,
} from "@/lib/userTimezone";
import useTranslation from "@/Hooks/useTranslation";
import type { MeetingPlatform } from "@/Components/Redesign/meeting/meetingFormUtils";
import {
    canUseZohoMeeting,
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
    isMeetingStartInFuture,
    locationForPayload,
    meetingLinkForPayload,
    requiresManualMeetingLink,
    requiresMeetingParticipants,
    requiresPhysicalLocationDetail,
    usesAutoMeetingLink,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export interface DealMeetingCreateInput {
    meetingTypeId: number | null;
    date: string;
    startTime: string;
    endTime: string;
    duration: number | null;
    platform: MeetingPlatform;
    locationDetail: string;
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
    const { props } = usePage();

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
                    t("pages.deals.workspace.meetings.validation.no_agent"),
                );
            }

            if (!input.meetingTypeId) {
                validationErrors.push(
                    t("pages.deals.workspace.meetings.validation.select_meeting_type"),
                );
            }

            if (!input.date) {
                validationErrors.push(
                    t("pages.deals.workspace.meetings.validation.select_date"),
                );
            }

            if (!input.startTime) {
                validationErrors.push(
                    t("pages.deals.workspace.meetings.validation.select_start_time"),
                );
            } else if (
                input.date &&
                !isMeetingStartInFuture(input.date, input.startTime)
            ) {
                validationErrors.push(
                    t("pages.deals.workspace.meetings.validation.start_time_future"),
                );
            }

            if (!input.platform) {
                validationErrors.push(
                    t("pages.deals.workspace.meetings.validation.select_platform"),
                );
            }

            if (
                usesAutoMeetingLink(input.platform) &&
                !canUseZohoMeeting(props.auth?.user?.email)
            ) {
                validationErrors.push(
                    t("pages.deals.workspace.meetings.validation.zoho_email_only"),
                );
            }

            if (
                requiresMeetingParticipants(input.platform) &&
                input.participants.length === 0
            ) {
                validationErrors.push(
                    t("pages.deals.workspace.meetings.validation.participants_required"),
                );
            }

            if (
                requiresManualMeetingLink(input.platform) &&
                !input.meetingLink.trim()
            ) {
                validationErrors.push(
                    t("pages.deals.workspace.meetings.validation.paste_meeting_link"),
                );
            }

            if (
                requiresPhysicalLocationDetail(input.platform) &&
                !input.locationDetail.trim()
            ) {
                validationErrors.push(
                    t("pages.deals.workspace.meetings.validation.enter_location"),
                );
            }

            if (validationErrors.length > 0) {
                setErrors(validationErrors);
                return;
            }

            persistUserTimezoneOnce(props.auth?.user?.timezone);

            const payload: FollowUpStorePayload = {
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
                            : [formatted.message || t("pages.deals.workspace.meetings.messages.schedule_failed")],
                    );
                },
            });
        },
        [deal, mutate, props.auth?.user?.timezone, setDealFollowUps, t],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createMeeting,
        isCreating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
