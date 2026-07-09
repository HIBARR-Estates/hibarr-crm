export type ZohoCalendarSyncUiStatus = "pending" | "synced" | "failed";

export interface ZohoCalendarEventJobStatusData {
    jobId: string;
    meetingId: string;
    status: string;
    zohoEventId: string | null;
    error: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ZohoCalendarEventJobStatusResponse {
    success: boolean;
    message: string;
    data: ZohoCalendarEventJobStatusData;
}

