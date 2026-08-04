import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import { Modal } from "antd";
import type { Lead } from "@/Types/api/leads";
import type { DealFollowup, Reminder } from "@/Types/api/deal-followup";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import {
    getBrowserTimezone,
    persistUserTimezoneOnce,
} from "@/lib/userTimezone";
import type { MeetingPlatform } from "@/Components/Redesign/meeting/meetingFormUtils";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
    isMeetingStartInFuture,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

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
    /** When true, skip the soft duplicate-meeting warning. */
    confirmDuplicate?: boolean;
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

function timesOverlap(
    aDate: string,
    aStart: string,
    existingDateTime: string | null | undefined,
): boolean {
    if (!aDate || !aStart || !existingDateTime) return false;
    const a = new Date(`${aDate}T${aStart}`);
    const b = new Date(existingDateTime);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
    return Math.abs(a.getTime() - b.getTime()) < 60_000;
}

function extractFollowUp(response: unknown): DealFollowup | null {
    if (!response || typeof response !== "object") return null;
    const body = response as Record<string, unknown>;
    if (body.status && body.status !== "success") return null;
    const data = body.data;
    if (data && typeof data === "object" && "id" in data) {
        return data as DealFollowup;
    }
    return null;
}

export default function useLeadMeetingCreate(lead: Lead) {
    const [errors, setErrors] = useState<string[]>([]);
    const { props } = usePage();
    const { leadFollowUps, addLeadFollowUp } = useLeadWorkspace();

    const { mutate, status } = useApiMutate<
        FollowUpStorePayload,
        DealFollowup,
        ApiResponse<DealFollowup>
    >(route("deals.follow_up_store"), "POST");

    const submitMeeting = useCallback(
        (input: LeadMeetingCreateInput, onSuccess?: () => void) => {
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
                onSuccess: (response) => {
                    setErrors([]);
                    const followUp = extractFollowUp(response);
                    if (followUp) {
                        // Patch local list immediately — don't wait on deferred reload.
                        addLeadFollowUp(followUp);
                    }
                    // Success toast comes from useApiMutate (response.message).
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
                            : [
                                  formatted.message ||
                                      "Failed to schedule meeting",
                              ],
                    );
                },
            });
        },
        [addLeadFollowUp, lead.id, mutate, props.auth?.user?.timezone],
    );

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

            if (input.platform === "zoho" && input.participants.length === 0) {
                validationErrors.push(
                    "At least one participant is required for video meetings.",
                );
            }

            if (validationErrors.length > 0) {
                setErrors(validationErrors);
                return;
            }

            if (!input.confirmDuplicate) {
                const participantSet = new Set(input.participants);
                const duplicate = (leadFollowUps ?? []).some((existing) => {
                    const existingParticipants = (existing.participants ??
                        []) as number[];
                    const timeMatch = timesOverlap(
                        input.date,
                        input.startTime,
                        existing.next_follow_up_date as string | undefined,
                    );
                    if (!timeMatch) return false;
                    if (participantSet.size === 0) return true;
                    return existingParticipants.some((id) =>
                        participantSet.has(Number(id)),
                    );
                });

                if (duplicate) {
                    Modal.confirm({
                        title: "Possible duplicate meeting",
                        content:
                            "A meeting already exists at this date and time with overlapping participants. Create another anyway?",
                        okText: "Create anyway",
                        cancelText: "Cancel",
                        onOk: () =>
                            submitMeeting(
                                { ...input, confirmDuplicate: true },
                                onSuccess,
                            ),
                    });
                    return;
                }
            }

            submitMeeting(input, onSuccess);
        },
        [lead.lead_owner?.id, leadFollowUps, submitMeeting],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createMeeting,
        isCreating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
