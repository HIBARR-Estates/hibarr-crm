import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

export interface MeetingTalkingPoints {
    points: string[];
    meta: { generated_at?: string; is_stale?: boolean; source?: string };
}

/** What the brief already worked out, so the points can build on it. */
export interface MeetingBriefContext {
    next_stage: string | null;
    open_conditions: string[];
    open_questions: string[];
}

interface Result {
    talkingPoints: MeetingTalkingPoints | null;
    /** True while points are being looked up or written. */
    loading: boolean;
    error: string | null;
    regenerate: () => void;
}

/**
 * AI talking points for one meeting on a deal. Reads the stored points; when
 * there are none, or the deal or meeting changed since they were written, it
 * writes them once in the background. A failed write is not retried until the
 * agent asks again (or opens the brief again).
 */
export default function useMeetingTalkingPoints(dealId: number, meetingId: number, context: MeetingBriefContext, enabled: boolean): Result {
    const [talkingPoints, setTalkingPoints] = useState<MeetingTalkingPoints | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);
    const contextRef = useRef(context);
    contextRef.current = context;
    const inFlight = useRef(false);

    const write = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        setLoading(true);
        setError(null);
        try {
            const { data } = await axios.post<{ talking_points: MeetingTalkingPoints }>(
                route("deals.meeting-talking-points.generate", { deal: dealId, meeting: meetingId }),
                contextRef.current,
                { timeout: 60000 },
            );
            setTalkingPoints(data.talking_points);
        } catch (err) {
            const response = axios.isAxiosError(err) ? err.response?.data : null;
            if (response?.talking_points) setTalkingPoints(response.talking_points);
            setError(typeof response?.message === "string" ? response.message : "error");
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }, [dealId, meetingId]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        setTalkingPoints(null);
        setError(null);
        setLoading(true);

        axios
            .get<{ talking_points: MeetingTalkingPoints | null }>(route("deals.meeting-talking-points", { deal: dealId, meeting: meetingId }), { timeout: 15000 })
            .then(({ data }) => {
                if (cancelled) return;
                const stored = data.talking_points;
                setTalkingPoints(stored);
                if (!stored || stored.points.length === 0 || stored.meta?.is_stale) {
                    void write();
                } else {
                    setLoading(false);
                }
            })
            .catch(() => {
                if (cancelled) return;
                setError("error");
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [dealId, meetingId, enabled, write]);

    return { talkingPoints, loading, error, regenerate: () => void write() };
}
