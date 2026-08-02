import axios from "axios";
import type { CalendarSyncStatusResponse } from "@/Types/calendar-sync";

export class CalendarSyncService {
    async getJobStatus(
        followUpId: number | string,
    ): Promise<CalendarSyncStatusResponse> {
        const response = await axios.get<CalendarSyncStatusResponse>(
            `/account/follow-ups/${followUpId}/calendar-sync/status`,
            {
                headers: {
                    Accept: "application/json",
                },
            },
        );

        return response.data;
    }
}
