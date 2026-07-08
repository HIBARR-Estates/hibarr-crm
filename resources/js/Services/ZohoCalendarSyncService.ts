import axios from "axios";
import { getOlApiKey, getOlBaseUrl } from "@/lib/config";
import type {
    ZohoCalendarEventJobStatusResponse,
} from "@/Types/zoho-calendar-sync";

export class ZohoCalendarSyncService {
    private baseUrl: string;
    private apiKey: string;

    constructor() {
        this.baseUrl = getOlBaseUrl();
        this.apiKey = getOlApiKey();
    }

    async getJobStatus(
        jobId: string,
    ): Promise<ZohoCalendarEventJobStatusResponse> {
        const response = await axios.get<ZohoCalendarEventJobStatusResponse>(
            `${this.baseUrl}/integrations/zoho/calendar/events/${jobId}/status`,
            {
                headers: {
                    "X-Api-Key": this.apiKey,
                    Accept: "application/json",
                },
            },
        );

        return response.data;
    }
}

