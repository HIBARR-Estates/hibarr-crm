import { useEffect, useState } from "react";
import type { MeetingParticipantSource } from "@/Components/Redesign/meeting/meetingFormUtils";

export type ScheduleRecordType = "deal" | "lead";

/** One of a lead's deals, as offered under the lead in the schedule dialog. */
export interface ScheduleDealOption {
    id: number;
    name: string;
    /** Stage, so two deals of one client can be told apart. */
    lead_stage?: { name?: string | null } | null;
}

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
    // Only a lead's answer carries these; empty for a deal.
    const [dealsForLead, setDealsForLead] = useState<ScheduleDealOption[]>([]);
    /**
     * The key `source` / `error` belong to, once that fetch has finished.
     * `loading` alone cannot say: on the first render after the key changes it
     * is still false and `source` is still the previous record's, so a caller
     * seeding a form from them would seed from the wrong person.
     */
    const [loadedKey, setLoadedKey] = useState<ScheduleRecordKey | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const parsed = parseRecordKey(key);
        if (!parsed) {
            setSource(null);
            setDealsForLead([]);
            setLoadedKey(null);
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
                    setDealsForLead(
                        (json.deals_for_lead as ScheduleDealOption[]) ?? [],
                    );
                } else {
                    setSource(null);
                    setDealsForLead([]);
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
                setDealsForLead([]);
                setError(
                    parsed.type === "deal"
                        ? "pages.meetings.schedule.failed_to_load"
                        : "pages.meetings.schedule.failed_to_load_lead",
                );
            })
            .finally(() => {
                if (cancelled) return;
                setLoading(false);
                setLoadedKey(key);
            });

        return () => {
            cancelled = true;
        };
    }, [key]);

    return { source, dealsForLead, loading, error, loadedKey };
}
