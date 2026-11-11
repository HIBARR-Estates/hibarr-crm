import { useCallback, useState } from "react";
import { message } from "antd";
import { router, usePage } from "@inertiajs/react";
import { errorFormatter } from "@/lib/api/utils/common";
import useTranslation from "@/Hooks/useTranslation";
import { getBrowserTimezone, persistUserTimezoneOnce } from "@/lib/userTimezone";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
} from "@/Components/Redesign/meeting/meetingFormUtils";

export interface MeetingRescheduleInput {
    date: string;
    startTime: string;
    duration: number | null;
}

interface RescheduleResponse {
    success?: boolean;
    message?: string;
}

/**
 * Reschedule a meeting from a page outside the deal and lead workspaces
 * (personal dashboard, agent Today).
 *
 * meetings.reschedule answers with a bare {success, message} and no record, so
 * there is nothing to patch from — success re-resolves the deferred props
 * instead. Inertia merges partial reloads, so the panel keeps its current rows
 * on screen rather than flashing back to a skeleton.
 *
 * ponytail: third copy of this fetch (useDealMeetingReschedule,
 * useLeadMeetingReschedule are the others). Collapse when the endpoint learns
 * to return the updated follow-up and the local-patch halves disappear.
 */
export default function useMeetingReschedule(
    followupId: number | null,
    /**
     * Deferred props to re-resolve once the meeting moves. Required rather
     * than defaulted: it used to hardcode the agent view's prop names, and
     * when that view was removed the reload became a silent no-op.
     */
    reloadKeys: string[],
) {
    const [errors, setErrors] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { props } = usePage();
    const { t } = useTranslation();

    const rescheduleMeeting = useCallback(
        async (
            input: MeetingRescheduleInput,
            onSuccess?: () => void,
        ) => {
            if (!followupId) return;

            const validationErrors: string[] = [];
            if (!input.date) validationErrors.push(t("pages.meetings.feedback.date_required"));
            if (!input.startTime) {
                validationErrors.push(t("pages.meetings.feedback.time_required"));
            }

            if (validationErrors.length > 0) {
                setErrors(validationErrors);
                return;
            }

            setIsSubmitting(true);
            setErrors([]);
            persistUserTimezoneOnce(props.auth?.user?.timezone, props.auth?.user?.timezone_locked);

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
                    message.success(t("pages.meetings.feedback.rescheduled"));
                    router.reload({ only: reloadKeys });
                    onSuccess?.();
                    return;
                }

                setErrors([json.message || t("pages.meetings.feedback.reschedule_failed")]);
            } catch (error) {
                const formatted = errorFormatter(error);
                setErrors([
                    formatted.message || t("pages.meetings.feedback.reschedule_failed"),
                ]);
            } finally {
                setIsSubmitting(false);
            }
        },
        [followupId, props.auth?.user?.timezone, props.auth?.user?.timezone_locked, reloadKeys, t],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        rescheduleMeeting,
        isRescheduling: isSubmitting,
        errors,
        clearErrors,
    };
}
