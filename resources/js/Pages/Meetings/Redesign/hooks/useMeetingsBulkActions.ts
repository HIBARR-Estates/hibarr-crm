import { useCallback, useState } from "react";
import { message } from "antd";
import { router } from "@inertiajs/react";

/** Statuses the bulk status action can set — the column's own enum. */
export type MeetingBulkStatus = "scheduled" | "completed" | "cancelled";

interface UseMeetingsBulkActionsOptions {
    selectedIds: number[];
    clearSelection: () => void;
    /** Re-reads the list once the action lands. */
    onChanged: () => void;
}

/**
 * Bulk delete / status change for selected meetings.
 *
 * Posts to `deals.follow_up_apply_quick_action`, the endpoint the application
 * already uses for bulk follow-up actions — it re-checks the delete/edit
 * permission per record server-side, so the buttons here are an affordance,
 * not the guard.
 */
export default function useMeetingsBulkActions({
    selectedIds,
    clearSelection,
    onChanged,
}: UseMeetingsBulkActionsOptions) {
    const [isApplying, setIsApplying] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const apply = useCallback(
        (data: Record<string, string>) => {
            if (selectedIds.length === 0) return;

            setIsApplying(true);
            router.post(
                route("deals.follow_up_apply_quick_action"),
                { ...data, row_ids: selectedIds.join(",") },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        clearSelection();
                        onChanged();
                    },
                    onError: () => message.error("Bulk action failed"),
                    onFinish: () => setIsApplying(false),
                },
            );
        },
        [selectedIds, clearSelection, onChanged],
    );

    return {
        isApplying,
        confirmDelete,
        openConfirmDelete: () => setConfirmDelete(true),
        closeConfirmDelete: () => setConfirmDelete(false),
        deleteSelected: () => {
            setConfirmDelete(false);
            apply({ action_type: "delete" });
        },
        setStatus: (status: MeetingBulkStatus) =>
            apply({ action_type: "change-status", status }),
    };
}
