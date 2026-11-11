import { useState } from "react";
import { message } from "antd";
import { router } from "@inertiajs/react";
import axios from "axios";
import { errorFormatter } from "@/lib/api/utils/common";
import useTranslation from "@/Hooks/useTranslation";

type FollowUpStatus = "scheduled" | "completed" | "cancelled";

/**
 * Set a meeting's status from a page outside the deal and lead workspaces
 * (personal dashboard, agent Today).
 *
 * This is what makes "meetings held" a recorded fact rather than an inference
 * from the date. Until something wrote 'completed' through a working path, the
 * manager view had to count past-and-not-cancelled and say so.
 *
 * `reloadKeys` names the deferred props the caller actually renders (e.g. the
 * personal dashboard's `agenda`), so the reload asks the server only for data
 * it will use. Required rather than defaulted: it used to fall back to the
 * agent view's prop names, and when that view was removed the default became a
 * silent no-op reload.
 *
 * `onError` lets a caller that already showed the new status (optimistically)
 * put the old one back.
 */
export default function useMeetingStatus(
    onChanged: () => void,
    reloadKeys: string[],
    onError?: (followUpId: number) => void,
) {
    const { t } = useTranslation();
    const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());

    const setStatus = async (followUpId: number, status: FollowUpStatus) => {
        setPendingIds((prev) => new Set(prev).add(followUpId));

        try {
            await axios.post(route("deals.change_follow_up_status"), {
                id: followUpId,
                status,
            });
            message.success(
                status === "completed"
                    ? t("pages.meetings.feedback.marked_held")
                    : t("pages.meetings.feedback.updated"),
            );
            router.reload({ only: reloadKeys });
            onChanged();
        } catch (error) {
            const formatted = errorFormatter(error);
            message.error(formatted.message || t("pages.meetings.feedback.update_failed"));
            onError?.(followUpId);
        } finally {
            setPendingIds((prev) => {
                const next = new Set(prev);
                next.delete(followUpId);
                return next;
            });
        }
    };

    return {
        markHeld: (followUpId: number) => setStatus(followUpId, "completed"),
        isPending: (followUpId: number) => pendingIds.has(followUpId),
    };
}
