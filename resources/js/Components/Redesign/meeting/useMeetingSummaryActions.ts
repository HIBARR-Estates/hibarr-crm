import { useCallback, useState } from "react";
import axios from "axios";
import type { MeetingSummary } from "@/Types/api/deal-followup";

/** One section of the summary as the editor holds it. */
export interface SummarySection {
    key: string;
    value: string;
}

interface SummaryResponse {
    success: boolean;
    message?: string;
    meeting_summary?: MeetingSummary | null;
}

/** The server's own reason when it gave one (a validation or permission message). */
function reasonFrom(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | { message?: unknown; errors?: Record<string, string[]> }
            | undefined;
        const firstField = data?.errors
            ? Object.values(data.errors).flat()[0]
            : undefined;
        if (typeof firstField === "string") return firstField;
        if (typeof data?.message === "string" && data.message.trim()) {
            return data.message;
        }
    }
    return fallback;
}

/**
 * Writing, taking back and re-requesting a meeting's summary.
 *
 * Each action returns what the server now holds (or null on failure, with
 * `error` set), so the panel patches its own state from the answer instead of
 * reloading the page.
 */
export default function useMeetingSummaryActions(meetingId: number) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = useCallback(
        async <T>(
            call: () => Promise<T>,
            fallback: string,
        ): Promise<T | null> => {
            setSaving(true);
            setError(null);
            try {
                return await call();
            } catch (caught) {
                setError(reasonFrom(caught, fallback));
                return null;
            } finally {
                setSaving(false);
            }
        },
        [],
    );

    /** Writes or corrects the summary by hand. */
    const saveSummary = useCallback(
        (sections: SummarySection[]) =>
            run(async () => {
                const { data } = await axios.put<SummaryResponse>(
                    route("meetings.summary.save", { followUp: meetingId }),
                    { sections },
                    { headers: { Accept: "application/json" } },
                );
                return data;
            }, "Could not save the summary."),
        [meetingId, run],
    );

    /** Takes the automatic summary over the one a person wrote. */
    const adoptAutomaticSummary = useCallback(
        () =>
            run(async () => {
                const { data } = await axios.post<SummaryResponse>(
                    route("meetings.summary.use_automatic", {
                        followUp: meetingId,
                    }),
                    {},
                    { headers: { Accept: "application/json" } },
                );
                return data;
            }, "Could not switch to the automatic summary."),
        [meetingId, run],
    );

    /** Asks the meeting automation to send the summary again. */
    const retrySummary = useCallback(
        () =>
            run(async () => {
                const { data } = await axios.post<{
                    success: boolean;
                    message?: string;
                    summary_retry_requested_at?: string;
                    summary_retry_count?: number;
                }>(
                    route("meetings.summary.retry", { followUp: meetingId }),
                    {},
                    { headers: { Accept: "application/json" } },
                );
                return data;
            }, "Could not ask for the summary again."),
        [meetingId, run],
    );

    return {
        saveSummary,
        adoptAutomaticSummary,
        retrySummary,
        saving,
        error,
        clearError: useCallback(() => setError(null), []),
    };
}
