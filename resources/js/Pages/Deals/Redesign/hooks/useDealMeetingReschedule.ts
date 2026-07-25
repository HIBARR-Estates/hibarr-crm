import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import { message } from "antd";
import { errorFormatter } from "@/lib/api/utils/common";
import {
    getBrowserTimezone,
    persistUserTimezoneOnce,
} from "@/lib/userTimezone";
import useTranslation from "@/Hooks/useTranslation";
import {
    formatMeetingDateForApi,
    formatMeetingTimeForApi,
} from "../components/workspace/meetingFormUtils";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export interface DealMeetingRescheduleInput {
    date: string;
    startTime: string;
    duration: number | null;
}

interface RescheduleResponse {
    success?: boolean;
    message?: string;
}

export default function useDealMeetingReschedule(followupId: number | null) {
    const { t } = useTranslation();
    const [errors, setErrors] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { setDealFollowUps } = useDealWorkspace();
    const { props } = usePage<{
        auth?: { user?: { timezone?: string | null } | null };
    }>();

    const rescheduleMeeting = useCallback(
        async (input: DealMeetingRescheduleInput, onSuccess?: () => void) => {
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
                    message.success(t("pages.deals.workspace.meetings.messages.rescheduled"));
                    const newDate = new Date(
                        `${input.date}T${input.startTime}`,
                    ).toISOString();
                    setDealFollowUps((prev) =>
                        prev.map((f) =>
                            f.id === followupId
                                ? {
                                      ...f,
                                      next_follow_up_date: newDate,
                                      duration: input.duration,
                                      status: "scheduled",
                                  }
                                : f,
                        ),
                    );
                    onSuccess?.();
                    return;
                }

                setErrors([json.message || "Failed to reschedule meeting"]);
            } catch (error) {
                const formatted = errorFormatter(error);
                setErrors([formatted.message || "Failed to reschedule meeting"]);
            } finally {
                setIsSubmitting(false);
            }
        },
        [followupId, props.auth?.user?.timezone, setDealFollowUps, t],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        rescheduleMeeting,
        isRescheduling: isSubmitting,
        errors,
        clearErrors,
    };
}
