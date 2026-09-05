import { useCallback, useEffect, useState } from "react";
import type { DealFollowup } from "@/Types/api/deal-followup";

/**
 * One meeting, by id — what the calendar needs when a chip is clicked.
 *
 * Chips carry only what it takes to draw them, and the meeting behind one is
 * often not on the list page that's loaded, so the detail dialog is fed from
 * `meetings.show` rather than from the list. `seed` covers the case where the
 * row *is* already on the page (cards/list view): the dialog opens on the
 * record it already has and never waits for a request.
 */
export default function useMeetingRecord() {
    const [meeting, setMeeting] = useState<DealFollowup | null>(null);
    const [loadingId, setLoadingId] = useState<number | null>(null);

    const close = useCallback(() => {
        setMeeting(null);
        setLoadingId(null);
    }, []);

    const seed = useCallback((record: DealFollowup) => {
        setLoadingId(null);
        setMeeting(record);
    }, []);

    const open = useCallback((meetingId: number) => {
        setMeeting(null);
        setLoadingId(meetingId);
    }, []);

    useEffect(() => {
        if (loadingId === null) return undefined;

        // A slower earlier request must not replace a newer selection.
        let cancelled = false;

        fetch(route("meetings.show", { followUp: loadingId }), {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        })
            .then((response) => response.json())
            .then((json) => {
                if (cancelled) return;
                if (json?.success) setMeeting(json.data as DealFollowup);
                setLoadingId(null);
            })
            .catch(() => {
                if (!cancelled) setLoadingId(null);
            });

        return () => {
            cancelled = true;
        };
    }, [loadingId]);

    return { meeting, loading: loadingId !== null, open, seed, close };
}
