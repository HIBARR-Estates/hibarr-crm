import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { router } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import useMeetingsImprovementsFlag from "@/Hooks/useMeetingsImprovementsFlag";

/** Statuses the bulk status action can set — the column's own enum. */
export type MeetingBulkStatus = "scheduled" | "completed" | "cancelled";

/** What a bulk action did, for the caller to patch its list with. */
export type MeetingBulkChange =
    | { type: "delete"; ids: number[] }
    | { type: "status"; ids: number[]; status: MeetingBulkStatus };

interface UseMeetingsBulkActionsOptions {
    selectedIds: number[];
    clearSelection: () => void;
    /**
     * Paints the change into the list the moment the server confirms it, so
     * the rows react without waiting on the reload that follows. Only used
     * with `crm.meetings-page-improvements`.
     */
    onApplied?: (change: MeetingBulkChange) => void;
    /** Re-reads the list (and the cards, counts and pager) once it lands. */
    onChanged: () => void;
}

interface BulkResponse {
    success: boolean;
    message?: string;
    ids?: number[];
}

/** The server's own reason when it gave one (a permission refusal, say). */
function serverMessage(error: unknown): string | null {
    if (!axios.isAxiosError(error)) return null;
    const text = (error.response?.data as { message?: unknown } | undefined)
        ?.message;
    return typeof text === "string" && text.trim() !== "" ? text : null;
}

/**
 * Bulk delete / status change for selected meetings.
 *
 * Posts to `deals.follow_up_apply_quick_action`, the endpoint the application
 * already uses for bulk follow-up actions — it re-checks the delete/edit
 * permission per record server-side, so the buttons here are an affordance,
 * not the guard.
 *
 * Asked for as JSON, so the answer is a few ids rather than a redirect that
 * makes Inertia send the whole page's props back. The list is patched from
 * that answer straight away and reconciled by one partial reload after it.
 */
export default function useMeetingsBulkActions({
    selectedIds,
    clearSelection,
    onApplied,
    onChanged,
}: UseMeetingsBulkActionsOptions) {
    const { t } = useTranslation();
    const improved = useMeetingsImprovementsFlag();
    const [isApplying, setIsApplying] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const apply = useCallback(
        async (
            data: Record<string, string>,
            toChange: (ids: number[]) => MeetingBulkChange,
        ) => {
            // A second click while the first is in flight would send the same
            // ids twice — the second delete would find nothing to delete.
            if (selectedIds.length === 0 || isApplying) return;

            // Without `crm.meetings-page-improvements`: an Inertia post that
            // the server answers with a redirect, then the caller's reload.
            if (!improved) {
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
                        onError: () =>
                            message.error(t("pages.meetings.ui.bulk_action_failed")),
                        onFinish: () => setIsApplying(false),
                    },
                );
                return;
            }

            setIsApplying(true);
            try {
                const { data: result } = await axios.post<BulkResponse>(
                    route("deals.follow_up_apply_quick_action"),
                    { ...data, row_ids: selectedIds.join(",") },
                    { headers: { Accept: "application/json" } },
                );

                if (!result.success) {
                    message.error(
                        result.message ?? t("pages.meetings.ui.bulk_action_failed"),
                    );
                    return;
                }

                message.success(
                    result.message ?? t("pages.meetings.ui.done"),
                );
                onApplied?.(toChange(result.ids ?? selectedIds));
                clearSelection();
                onChanged();
            } catch (error) {
                message.error(
                    serverMessage(error) ??
                        t("pages.meetings.ui.bulk_action_failed"),
                );
            } finally {
                setIsApplying(false);
            }
        },
        [selectedIds, isApplying, improved, clearSelection, onApplied, onChanged, t],
    );

    return {
        isApplying,
        confirmDelete,
        openConfirmDelete: () => setConfirmDelete(true),
        closeConfirmDelete: () => setConfirmDelete(false),
        deleteSelected: () => {
            setConfirmDelete(false);
            void apply({ action_type: "delete" }, (ids) => ({
                type: "delete",
                ids,
            }));
        },
        setStatus: (status: MeetingBulkStatus) =>
            void apply({ action_type: "change-status", status }, (ids) => ({
                type: "status",
                ids,
                status,
            })),
    };
}
