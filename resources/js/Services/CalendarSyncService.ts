import axios from "axios";
import type {
    CalendarSyncRetryResult,
    CalendarSyncStatusData,
    CalendarSyncStatusResponse,
} from "@/Types/calendar-sync";

const JSON_HEADERS = { Accept: "application/json" };

export class CalendarSyncService {
    async getJobStatus(
        followUpId: number | string,
    ): Promise<CalendarSyncStatusResponse> {
        const response = await axios.get<CalendarSyncStatusResponse>(
            `/account/follow-ups/${followUpId}/calendar-sync/status`,
            { headers: JSON_HEADERS },
        );

        return response.data;
    }

    /**
     * Re-sends the meeting to OL. A rejection comes back as HTTP 422 carrying
     * OL's error — resolved as `ok: false` rather than thrown, since callers
     * show that reason inline next to the retry button.
     */
    async retry(followUpId: number | string): Promise<CalendarSyncRetryResult> {
        try {
            const response = await axios.post<{
                message?: string;
                data: CalendarSyncStatusData;
            }>(`/account/follow-ups/${followUpId}/calendar-sync/retry`, null, {
                headers: JSON_HEADERS,
            });

            return {
                ok: true,
                data: response.data.data,
                message: response.data.message,
            };
        } catch (error) {
            const body = axios.isAxiosError(error)
                ? (error.response?.data as
                      | { message?: string; data?: CalendarSyncStatusData }
                      | undefined)
                : undefined;

            if (body?.data) {
                return { ok: false, data: body.data, message: body.message };
            }

            throw error;
        }
    }
}
