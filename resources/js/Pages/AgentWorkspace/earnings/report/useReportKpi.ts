import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import type { ReportKpi, ReportRange } from "./types";

/**
 * The period and the cards for it. The first period's cards arrive with the
 * page; the others are fetched the first time the agent switches to them and
 * kept, so going back is instant. The period lives in the address (`?range=`)
 * so the screen can be shared and reloaded, without a navigation.
 */
export default function useReportKpi(initialRange: ReportRange, initial: ReportKpi | null | undefined) {
    const [range, setRangeState] = useState<ReportRange>(initialRange);
    const [byRange, setByRange] = useState<Partial<Record<ReportRange, ReportKpi>>>({});
    const [failed, setFailed] = useState<ReportRange | null>(null);
    // The page's own deferred request already covers the first period, so it is not asked for again here.
    const asked = useRef(new Set<ReportRange>([initialRange]));

    // The deferred props land after the first paint.
    useEffect(() => {
        if (!initial) return;
        asked.current.add(initial.range);
        setByRange((current) => ({ ...current, [initial.range]: initial }));
    }, [initial]);

    useEffect(() => {
        if (byRange[range] || asked.current.has(range)) return;
        asked.current.add(range);
        setFailed((current) => (current === range ? null : current));
        axios
            .get<ReportKpi>(route("agent.earnings.report.kpi"), { params: { range } })
            .then((response) => setByRange((current) => ({ ...current, [range]: response.data })))
            .catch(() => {
                asked.current.delete(range);
                setFailed(range);
            });
    }, [range, byRange]);

    const setRange = useCallback((next: ReportRange) => {
        setRangeState(next);
        try {
            const url = new URL(window.location.href);
            url.searchParams.set("range", next);
            window.history.replaceState(window.history.state, "", url);
        } catch {
            // The address is a convenience; the period still switches.
        }
    }, []);

    const retry = useCallback(() => {
        asked.current.delete(range);
        setFailed(null);
        setByRange((current) => ({ ...current }));
    }, [range]);

    return { range, setRange, kpi: byRange[range] ?? null, failed: failed === range, retry };
}
