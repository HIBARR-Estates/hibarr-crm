import { useCallback, useRef, useState } from "react";
import axios from "axios";
import type { ReportRange, ReportWindow } from "./types";

interface Args {
    agentId: number | null;
    agentName: string;
}

export type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * The AI summary of the agent's notes for the period, on the classic Agent
 * Reports endpoints: generated when asked for (it takes a few seconds and is
 * cached for the hour server-side), kept per period here, and saved as a
 * summary note under the same title the classic screen proposes.
 */
export default function useReportSummary({ agentId, agentName }: Args) {
    const [byRange, setByRange] = useState<Partial<Record<ReportRange, string>>>({});
    const [loading, setLoading] = useState<ReportRange | null>(null);
    const [error, setError] = useState<{ range: ReportRange; kind: "timeout" | "failed" } | null>(null);
    const [saves, setSaves] = useState<Partial<Record<ReportRange, SaveState>>>({});
    const running = useRef(false);

    const filters = useCallback(
        (window: ReportWindow) => ({
            start_date: window.start,
            end_date: window.end,
            view_type: "agent" as const,
            ...(agentId ? { agent_id: agentId } : {}),
        }),
        [agentId],
    );

    const generate = useCallback(
        async (window: ReportWindow, refresh: boolean) => {
            if (running.current) return;
            running.current = true;
            setLoading(window.key);
            setError(null);
            setSaves((current) => ({ ...current, [window.key]: "idle" }));
            try {
                const response = await axios.post<{ summary: string }>(
                    "/account/agent-reports/ai-summary",
                    { ...filters(window), ...(refresh ? { refresh: true } : {}) },
                    { timeout: 30000 },
                );
                setByRange((current) => ({ ...current, [window.key]: response.data.summary }));
            } catch (caught) {
                setError({ range: window.key, kind: (caught as { code?: string })?.code === "ECONNABORTED" ? "timeout" : "failed" });
            } finally {
                running.current = false;
                setLoading(null);
            }
        },
        [filters],
    );

    const saveAsNote = useCallback(
        async (window: ReportWindow) => {
            const summary = byRange[window.key];
            if (!summary) return;
            setSaves((current) => ({ ...current, [window.key]: "saving" }));
            try {
                await axios.post(
                    "/account/agent-reports/saved-summaries",
                    {
                        title: `AI Summary: ${agentName} (${window.start} to ${window.end})`,
                        description: null,
                        summary,
                        ...filters(window),
                        context_label: agentName,
                    },
                    { timeout: 15000 },
                );
                setSaves((current) => ({ ...current, [window.key]: "saved" }));
            } catch {
                setSaves((current) => ({ ...current, [window.key]: "failed" }));
            }
        },
        [agentName, byRange, filters],
    );

    return { summaries: byRange, loading, error, saves, generate, saveAsNote };
}
