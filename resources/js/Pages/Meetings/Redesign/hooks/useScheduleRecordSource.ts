import { useEffect, useState } from "react";
import type { MeetingParticipantSource } from "@/Components/Redesign/meeting/meetingFormUtils";

export type ScheduleRecordType = "deal" | "lead";

/** `deal-12` / `lead-7` — the value the related-record select carries. */
export type ScheduleRecordKey = `${ScheduleRecordType}-${number}`;

export function recordKey(
    type: ScheduleRecordType,
    id: number,
): ScheduleRecordKey {
    return `${type}-${id}`;
}

export function parseRecordKey(
    key: ScheduleRecordKey | null,
): { type: ScheduleRecordType; id: number } | null {
    if (!key) return null;
    const [type, id] = key.split("-");
    const numericId = Number(id);
    if ((type !== "deal" && type !== "lead") || !Number.isFinite(numericId)) {
        return null;
    }
    return { type, id: numericId };
}

/**
 * Loads the deal/lead behind the chosen related record — its participants,
 * watchers and agent/owner seed the meeting form's defaults, and the owner is
 * locked into participants. Same two endpoints the legacy schedule drawer
 * uses, so nothing new is exposed.
 */
export default function useScheduleRecordSource(key: ScheduleRecordKey | null) {
    const [source, setSource] = useState<MeetingParticipantSource | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const parsed = parseRecordKey(key);
        if (!parsed) {
            setSource(null);
            setError(null);
            setLoading(false);
            return undefined;
        }

        // A slower earlier request must not overwrite a newer selection.
        let cancelled = false;
        setLoading(true);
        setError(null);

        fetch(`/account/meetings/${parsed.type}/${parsed.id}`, {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        })
            .then((response) => response.json())
            .then((json) => {
                if (cancelled) return;
                if (json?.success) {
                    setSource(json.data as MeetingParticipantSource);
                } else {
                    setSource(null);
                    setError(
                        parsed.type === "deal"
                            ? "pages.meetings.schedule.failed_to_load"
                            : "pages.meetings.schedule.failed_to_load_lead",
                    );
                }
            })
            .catch(() => {
                if (cancelled) return;
                setSource(null);
                setError(
                    parsed.type === "deal"
                        ? "pages.meetings.schedule.failed_to_load"
                        : "pages.meetings.schedule.failed_to_load_lead",
                );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [key]);

    return { source, loading, error };
}
