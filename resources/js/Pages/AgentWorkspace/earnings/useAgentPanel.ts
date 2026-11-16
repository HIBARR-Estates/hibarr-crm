import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import type { AgentPanelData } from "./types";

type PanelState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; data: AgentPanelData };

/** A panel state tied to the agent it was loaded for, so one agent's data is never shown under another's name. */
type Tagged = { agentId: number | null; state: PanelState };

/**
 * The details panel for the picked agent. Each agent is fetched once and kept,
 * so going back to someone is instant; a newer pick cancels an older request.
 */
export default function useAgentPanel(agentId: number | null) {
    const cache = useRef(new Map<number, AgentPanelData>());
    const [tagged, setTagged] = useState<Tagged>({ agentId: null, state: { status: "idle" } });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (agentId === null) {
            setTagged({ agentId: null, state: { status: "idle" } });
            return;
        }
        const cached = cache.current.get(agentId);
        if (cached) {
            setTagged({ agentId, state: { status: "ready", data: cached } });
            return;
        }

        const controller = new AbortController();
        setTagged({ agentId, state: { status: "loading" } });
        axios
            .get<AgentPanelData>(route("agent.earnings.network.agent", agentId), { signal: controller.signal })
            .then(({ data }) => {
                cache.current.set(agentId, data);
                setTagged({ agentId, state: { status: "ready", data } });
            })
            .catch((error) => {
                if (!axios.isCancel(error)) setTagged({ agentId, state: { status: "error" } });
            });

        return () => controller.abort();
    }, [agentId, attempt]);

    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    // Until the effect has caught up with a new pick, the previous agent's state is not this agent's.
    let state: PanelState = { status: "idle" };
    if (agentId !== null) {
        const hit = cache.current.get(agentId);
        state = tagged.agentId === agentId ? tagged.state : hit ? { status: "ready", data: hit } : { status: "loading" };
    }

    return { state, retry };
}
