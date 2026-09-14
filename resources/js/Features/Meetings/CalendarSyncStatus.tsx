import { Spin, Button } from "antd";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
} from "@ant-design/icons";
import type { DealFollowup } from "@/Types/api/deal-followup";
import useCalendarSync, { canManageCalendarSync } from "@/Hooks/useCalendarSync";

type Props = {
    followup: DealFollowup;
    featureEnabled: boolean;
    isCreator: boolean;
    /** Lets the meeting's host see it too — the sync endpoints answer creator or host. */
    currentUserId?: number | null;
};

/** Legacy (antd) sync pill — same state and retry as MeetingCalendarSyncRow. */
export default function CalendarSyncStatus({
    followup,
    featureEnabled,
    isCreator,
    currentUserId,
}: Props) {
    const show =
        featureEnabled &&
        (isCreator || canManageCalendarSync(followup, currentUserId)) &&
        Boolean(
            followup?.zoho_calendar_job_id ||
                followup?.zoho_calendar_sync_status,
        );

    // Hooks run unconditionally — the early return comes after them.
    const { status, error, retry, retrying, hasMaxAttempts, refresh } =
        useCalendarSync(followup, show);

    if (!show || !status) return null;

    if (status === "synced") {
        return (
            <span className="inline-flex items-center gap-2 text-[12px] font-medium rounded-full px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircleOutlined />
                Synced
            </span>
        );
    }

    if (status === "failed") {
        return (
            <span
                className="inline-flex items-center gap-2 text-[12px] font-medium rounded-full px-2 py-1 bg-red-50 text-red-700 border border-red-100"
                title={error ?? undefined}
            >
                <CloseCircleOutlined />
                <span>{error ? `Sync failed: ${error}` : "Sync failed"}</span>
                <Button
                    type="link"
                    size="small"
                    className="!px-0"
                    onClick={() => void retry()}
                    loading={retrying}
                    disabled={retrying}
                >
                    Retry sync
                </Button>
            </span>
        );
    }

    return (
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
}
