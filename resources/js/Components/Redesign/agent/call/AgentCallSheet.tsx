import { useEffect, useState } from "react";
import useMediaQuery from "@/Hooks/useMediaQuery";
import useSoftphone from "@/Hooks/useSoftphone";
import useTranslation from "@/Hooks/useTranslation";
import AgentCallCard from "./AgentCallCard";
import { useFlowOpen } from "./agentCallBridge";
import useAgentCall from "./useAgentCall";
import "./agent-call.css";

/** Below this width the layout drops the dock for a bottom tab bar (agent-workspace.css). */
export const AGENT_PHONE_QUERY = "(max-width: 639px)";

/**
 * The call card on a phone, where the dock is not shown: the card sits above
 * the tab bar while a call runs and folds down to a one-line green bar. Other
 * widths render nothing here; the dock's pill is the only entry there.
 */
export default function AgentCallSheet() {
    const { t } = useTranslation();
    const { isEnabled } = useSoftphone();
    const { call, connected, elapsed } = useAgentCall();
    const flowOpen = useFlowOpen();
    const phone = useMediaQuery(AGENT_PHONE_QUERY);
    const [open, setOpen] = useState(false);
    const callId = call?.id ?? null;

    useEffect(() => {
        setOpen(callId !== null && !flowOpen);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callId]);

    // A flow that opens carries the call controls in its own header; the card gets out of its way.
    useEffect(() => {
        if (flowOpen) setOpen(false);
    }, [flowOpen]);

    if (!phone || !isEnabled || !call) return null;

    return (
        <div className="agent-call-sheet">
            {open ? (
                <AgentCallCard variant="sheet" onCollapse={() => setOpen(false)} />
            ) : (
                <button type="button" className="agent-call-sheet__bar" aria-expanded={false} onClick={() => setOpen(true)}>
                    <span className="agent-call-strip__dot" aria-hidden="true" />
                    {t("pages.agent_workspace.call.on_call")}
                    {" · "}
                    <span className="agent-call-sheet__time">
                        {connected && elapsed ? elapsed : t(`pages.agent_workspace.call.stage_${call.stage}`)}
                    </span>
                    <span aria-hidden="true">▴</span>
                </button>
            )}
        </div>
    );
}
