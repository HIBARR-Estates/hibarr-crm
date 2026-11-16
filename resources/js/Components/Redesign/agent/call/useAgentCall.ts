import { useCallback } from "react";
import useSoftphone from "@/Hooks/useSoftphone";
import { useElapsed } from "@/Components/Softphone/dock/utils";
import type { SoftphoneCall } from "@/Types/api/softphone";

/**
 * The call the agent is on, for the dock's pill and card and the strip inside
 * a qualification: the softphone's live call plus its timer and the three
 * controls. Null while nothing is dialled or connected, and while a call is
 * only ringing in (the softphone's own notice answers that).
 */
export default function useAgentCall() {
    const { isEnabled, state, hangup, setMuted, setHold } = useSoftphone();
    const call: SoftphoneCall | null =
        isEnabled && state.call && (state.call.phase === "active" || state.call.phase === "outbound") ? state.call : null;
    const connected = call?.stage === "connected";
    const elapsed = useElapsed(call ? (call.connectedAt ?? call.answeredAt ?? null) : null);

    const toggleMute = useCallback(() => {
        if (call) setMuted(!call.muted);
    }, [call, setMuted]);
    const toggleHold = useCallback(() => {
        if (call) setHold(!call.onHold);
    }, [call, setHold]);
    const end = useCallback(() => {
        // The softphone logs "call ended" itself, so a hang-up from the other side logs too.
        void hangup();
    }, [hangup]);

    return { call, connected, elapsed, toggleMute, toggleHold, end };
}
