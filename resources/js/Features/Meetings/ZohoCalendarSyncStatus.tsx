import React, { useEffect, useMemo, useState } from "react";
import { Spin, Button } from "antd";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    LoadingOutlined,
} from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { ZohoCalendarSyncUiStatus } from "@/Types/zoho-calendar-sync";
import { useZohoCalendarJobPoller } from "@/Hooks/useZohoCalendarJobPoller";

type RetryResponseData = {
    jobId: string | null;
    syncStatus: "pending" | "synced" | "failed" | null;
};

type Props = {
    followup: DealFollowup;
    featureEnabled: boolean;
    isCreator: boolean;
    hasZohoProfile: boolean;
};

export default function ZohoCalendarSyncStatus({
    followup,
    featureEnabled,
    isCreator,
    hasZohoProfile,
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

    const { status, hasMaxAttempts, refresh, isPolling } =
        useZohoCalendarJobPoller({
            jobId,
            initialStatus: effectiveInitialStatus,
            enabled: featureEnabled && isCreator && hasZohoProfile,
            intervalMs: 5000,
            maxAttempts: 5,
        });

    const show = featureEnabled && isCreator && hasZohoProfile;
    if (!show) return null;

    const uiStatus: ZohoCalendarSyncUiStatus | null = status;
    if (!uiStatus) return null;

    const retryUrl = `/account/follow-ups/${followup.id}/zoho-calendar-sync/retry`;
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
            <span>{hasMaxAttempts ? "Sync pending" : "Syncing to Zoho…"}</span>
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

