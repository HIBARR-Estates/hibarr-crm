import { useCallback, useState } from "react";
import { message } from "antd";
import { router, usePage } from "@inertiajs/react";
import { errorFormatter } from "@/lib/api/utils/common";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import {
    getBrowserTimezone,
    persistUserTimezoneOnce,
} from "@/lib/userTimezone";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
} from "@/Components/Redesign/meeting/meetingFormUtils";

export interface LeadIndexMeetingRescheduleInput {
    date: string;
    startTime: string;
    duration: number | null;
}

interface RescheduleResponse {
    success?: boolean;
    message?: string;
}

/**
 * Reschedule a meeting from the Leads index Next Action click-through.
 *
 * meetings.reschedule answers with a bare {success, message} and no record,
 * so there is nothing to patch from — success reloads the "leads" prop
 * instead, refreshing that row's Next Action cell.
 *
 * ponytail: fourth copy of this fetch (useDashboardMeetingReschedule,
 * useDealMeetingReschedule, useLeadMeetingReschedule are the others — see
 * useDashboardMeetingReschedule's own note). Collapse when the endpoint
 * learns to return the updated follow-up and the reload-target differences
 * disappear.
 */
export default function useLeadIndexMeetingReschedule(
    followupId: number | null,
) {
    const [errors, setErrors] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { props } = usePage();

    const rescheduleMeeting = useCallback(
        async (
            input: LeadIndexMeetingRescheduleInput,
            onSuccess?: () => void,
        ) => {
            if (!followupId) return;

            const validationErrors: string[] = [];
            if (!input.date) validationErrors.push("Please select a date.");
            if (!input.startTime) {
                validationErrors.push("Please select a start time.");
            }

            if (validationErrors.length > 0) {
                setErrors(validationErrors);
                return;
            }

            setIsSubmitting(true);
            setErrors([]);
            persistUserTimezoneOnce(props.auth?.user?.timezone);

            try {
                const response = await fetch(
                    route("meetings.reschedule", { followUp: followupId }),
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                            "X-CSRF-TOKEN":
                                document
                                    .querySelector('meta[name="csrf-token"]')
                                    ?.getAttribute("content") || "",
                            "X-Requested-With": "XMLHttpRequest",
                        },
                        body: JSON.stringify({
                            next_follow_up_date: formatMeetingDateForApi(
                                input.date,
                            ),
                            start_time: formatMeetingTimeForApi(input.startTime),
                            duration: input.duration,
                            timezone: getBrowserTimezone(),
                        }),
                    },
                );

                const json = (await response.json()) as RescheduleResponse;

                if (json.success) {
                    message.success("Meeting rescheduled");
                    router.get(
                        route("lead-contact.index"),
                        mergeQueryParams({}),
                        {
                            only: ["leads"],
                            preserveState: true,
                            preserveScroll: true,
                        },
                    );
                    onSuccess?.();
                    return;
                }

                setErrors([json.message || "Failed to reschedule meeting"]);
            } catch (error) {
                const formatted = errorFormatter(error);
                setErrors([
                    formatted.message || "Failed to reschedule meeting",
                ]);
            } finally {
                setIsSubmitting(false);
            }
        },
        [followupId, props.auth?.user?.timezone],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        rescheduleMeeting,
        isRescheduling: isSubmitting,
        errors,
        clearErrors,
    };
}
