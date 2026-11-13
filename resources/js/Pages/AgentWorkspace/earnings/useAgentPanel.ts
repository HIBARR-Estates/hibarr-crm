import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import type { AgentPanelData } from "./types";

type PanelState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; data: AgentPanelData };

/**
 * The details panel for the picked agent. Each agent is fetched once and kept,
 * so going back to someone is instant; a newer pick cancels an older request.
 */
export default function useAgentPanel(agentId: number | null) {
    const cache = useRef(new Map<number, AgentPanelData>());
    const [state, setState] = useState<PanelState>({ status: "idle" });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (agentId === null) {
            setState({ status: "idle" });
            return;
        }
        const cached = cache.current.get(agentId);
        if (cached) {
            setState({ status: "ready", data: cached });
            return;
        }

        const controller = new AbortController();
        setState({ status: "loading" });
        axios
            .get<AgentPanelData>(route("agent.earnings.network.agent", agentId), { signal: controller.signal })
            .then(({ data }) => {
                cache.current.set(agentId, data);
                setState({ status: "ready", data });
            })
            .catch((error) => {
                if (!axios.isCancel(error)) setState({ status: "error" });
            });

        return () => controller.abort();
    }, [agentId, attempt]);

    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    return { state, retry };
}
