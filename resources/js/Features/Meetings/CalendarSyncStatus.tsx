import React, { useEffect, useMemo, useState } from "react";
import { Spin, Button } from "antd";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
} from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { CalendarSyncUiStatus } from "@/Types/calendar-sync";
import { useCalendarSyncJobPoller } from "@/Hooks/useCalendarSyncJobPoller";

type RetryResponseData = {
    jobId: string | null;
    syncStatus: "pending" | "synced" | "failed" | null;
    eventUid?: string | null;
};

type Props = {
    followup: DealFollowup;
    featureEnabled: boolean;
    isCreator: boolean;
};

export default function CalendarSyncStatus({
    followup,
    featureEnabled,
    isCreator,
}: Props) {
    const [jobId, setJobId] = useState<string | null>(
        followup?.zoho_calendar_job_id ?? null,
    );
    const [syncStatus, setSyncStatus] = useState<
        "pending" | "synced" | "failed" | null
    >(followup?.zoho_calendar_sync_status ?? null);

    useEffect(() => {
        setJobId(followup?.zoho_calendar_job_id ?? null);
        setSyncStatus(
            (followup?.zoho_calendar_sync_status as
                | "pending"
                | "synced"
                | "failed"
                | null) ?? null,
        );
    }, [followup?.id]);

    const effectiveInitialStatus = useMemo(() => syncStatus, [syncStatus]);

    const show =
        featureEnabled &&
        isCreator &&
        Boolean(jobId || syncStatus);

    const { status, hasMaxAttempts, refresh } = useCalendarSyncJobPoller({
        followUpId: followup.id,
        jobId,
        initialStatus: effectiveInitialStatus,
        enabled: show,
        intervalMs: 5000,
        maxAttempts: 5,
        onStatus: (data) => {
            if (data.jobId !== undefined) {
                setJobId(data.jobId);
            }
            if (data.syncStatus) {
                setSyncStatus(data.syncStatus);
            }
        },
    });

    if (!show) return null;

    const uiStatus: CalendarSyncUiStatus | null = status;
    if (!uiStatus) return null;

    const retryUrl = `/account/follow-ups/${followup.id}/calendar-sync/retry`;
    const { mutate: retrySync, status: retryReqStatus } = useApiMutate<
        null,
        RetryResponseData,
        ApiResponse<RetryResponseData>
    >(retryUrl, "POST", (res) => {
        const newJobId = (res as ApiResponse<RetryResponseData>)?.data
            ?.jobId;
        const newSyncStatus = (res as ApiResponse<RetryResponseData>)?.data
            ?.syncStatus;

        setJobId(newJobId ?? null);
        setSyncStatus(newSyncStatus ?? null);
    });

    const isRetryLoading = retryReqStatus === "pending";

    const renderPending = () => (
        <span className="inline-flex items-center gap-2 text-[12px] font-medium rounded-full px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100">
            <Spin size="small" />
            <span>{hasMaxAttempts ? "Sync pending" : "Syncing to calendar…"}</span>
            {hasMaxAttempts && (
                <Button
                    type="link"
                    size="small"
                    className="!px-0"
                    onClick={() => refresh()}
                >
                    Refresh
                </Button>
            )}
        </span>
    );

    const renderSynced = () => (
        <span className="inline-flex items-center gap-2 text-[12px] font-medium rounded-full px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircleOutlined />
            Synced
        </span>
    );

    const renderFailed = () => (
        <span className="inline-flex items-center gap-2 text-[12px] font-medium rounded-full px-2 py-1 bg-red-50 text-red-700 border border-red-100">
            <CloseCircleOutlined />
            <span>Sync failed</span>
            <Button
                type="link"
                size="small"
                className="!px-0"
                onClick={() => retrySync(null)}
                disabled={isRetryLoading}
            >
                Retry sync
            </Button>
        </span>
    );

    switch (uiStatus) {
        case "synced":
            return renderSynced();
        case "failed":
            return renderFailed();
        case "pending":
        default:
            return renderPending();
    }
}
