import { useState } from "react";
import { message } from "antd";
import { router } from "@inertiajs/react";
import axios from "axios";
import { errorFormatter } from "@/lib/api/utils/common";

type FollowUpStatus = "scheduled" | "completed" | "cancelled";

/**
 * Set a meeting's status from the dashboard.
 *
 * This is what makes "meetings held" a recorded fact rather than an inference
 * from the date. Until something wrote 'completed' through a working path, the
 * manager view had to count past-and-not-cancelled and say so.
 *
 * `reloadKeys` defaults to the agent view's props — pass the deferred prop
 * names the caller actually renders (e.g. the personal dashboard's `agenda`)
 * so the reload asks the server for data it will use.
 */
export default function useDashboardMeetingStatus(
    onChanged: () => void,
    reloadKeys: string[] = ["todaySchedule", "agentWeek"],
) {
    const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());

    const setStatus = async (followUpId: number, status: FollowUpStatus) => {
        setPendingIds((prev) => new Set(prev).add(followUpId));

        try {
            await axios.post(route("deals.change_follow_up_status"), {
                id: followUpId,
                status,
            });
            message.success(
                status === "completed" ? "Marked as held" : "Meeting updated",
            );
            router.reload({ only: reloadKeys });
            onChanged();
        } catch (error) {
            const formatted = errorFormatter(error);
            message.error(formatted.message || "Could not update the meeting");
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
