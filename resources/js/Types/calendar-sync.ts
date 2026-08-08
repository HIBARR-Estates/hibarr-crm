export type CalendarSyncUiStatus = "pending" | "synced" | "failed";

export type CalendarSyncError = {
    code: string;
    message: string;
} | null;

export interface CalendarSyncStatusData {
    jobId: string | null;
    syncStatus: CalendarSyncUiStatus | null;
    eventUid: string | null;
    error: CalendarSyncError;
}

export interface CalendarSyncStatusResponse {
    status: string;
    message?: string;
    data: CalendarSyncStatusData;
}
