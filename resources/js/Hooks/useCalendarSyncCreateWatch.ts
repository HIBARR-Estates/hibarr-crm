import { useCallback, useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { message } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { CALENDAR_SYNC_FLAG } from "@/Hooks/useCalendarSync";
import { CalendarSyncService } from "@/Services/CalendarSyncService";
import type { DealFollowup } from "@/Types/api/deal-followup";

const WATCH_INTERVAL_MS = 2500;
const WATCH_ATTEMPTS = 6;

/**
 * The meeting save answers before its calendar sync runs (the sync is
 * dispatched after the response), so that request's 200 says nothing about
 * the sync. Call the returned function with the created meeting: it follows
 * the sync for ~15s and warns if OL rejects it, pointing at the retry in the
 * meeting dialog.
 */
export default function useCalendarSyncCreateWatch() {
    const { td } = useTd();
    const { props } = usePage();
    const flagOn = props.featureFlags?.[CALENDAR_SYNC_FLAG] === true;
    const service = useMemo(() => new CalendarSyncService(), []);

    return useCallback(
        (followUp: Pick<DealFollowup, "id"> | null | undefined) => {
            if (!flagOn || !followUp?.id) return;
            const followUpId = followUp.id;

            const poll = async (attempt: number) => {
                try {
                    const { data } = await service.getJobStatus(followUpId);
                    if (data.syncStatus === "failed" || data.error) {
                        message.warning(
                            `${td("Meeting saved, but the calendar sync failed", { source: "en" })}: ${td(
                                data.error?.message ?? "Unknown error",
                                { source: "en" },
                            )} ${td("Open the meeting to retry the sync.", { source: "en" })}`,
                            8,
                        );
                        return;
                    }
                    if (data.syncStatus !== "pending") return;
                } catch {
                    // Status unavailable — the meeting dialog still shows it.
                    return;
                }

                if (attempt < WATCH_ATTEMPTS) {
                    window.setTimeout(
                        () => void poll(attempt + 1),
                        WATCH_INTERVAL_MS,
                    );
                }
            };

            window.setTimeout(() => void poll(1), WATCH_INTERVAL_MS);
        },
        [flagOn, service, td],
    );
}
