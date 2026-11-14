import { useEffect, useRef, useState } from "react";
import { useIncomingCall } from "@/Components/Softphone/dock/incomingCallBridge";
import useMediaQuery from "@/Hooks/useMediaQuery";
import useSoftphone from "@/Hooks/useSoftphone";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "../primitives/Icon";
import AgentCallCard from "./call/AgentCallCard";
import AgentIncomingCard from "./call/AgentIncomingCard";
import { AGENT_PHONE_QUERY } from "./call/AgentCallSheet";
import { useFlowOpen } from "./call/agentCallBridge";
import useAgentCall from "./call/useAgentCall";

/**
 * The dock's softphone pill: the line's state at a glance (ready, not
 * connected) and, on a call, a green "On call · 00:38" that opens the call
 * card beneath it (canvas L7-06). The card opens by itself when a call starts,
 * unless a qualification is open, which carries the call controls itself.
 * While a call rings in, the pill is a blue "Incoming call" that opens the
 * incoming card by itself (L7-13) and keeps it up until the call is handled.
 * Hidden without the softphone flag; without a line it shows as not connected.
 */
export default function AgentSoftphonePill() {
    const { t } = useTranslation();
    const { isEnabled, hasLine, isReady } = useSoftphone();
    const { call, connected, elapsed } = useAgentCall();
    const flowOpen = useFlowOpen();
    const incoming = useIncomingCall();
    const incomingId = incoming?.id ?? null;
    const phone = useMediaQuery(AGENT_PHONE_QUERY);
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLSpanElement>(null);
    const callId = call?.id ?? null;

    // A new call opens its card once; the agent closes it and it stays closed.
    useEffect(() => {
        setOpen(callId !== null && !flowOpen);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callId]);

    // A call that rings in opens its card at once.
    useEffect(() => {
        if (incomingId !== null) setOpen(true);
    }, [incomingId]);

    // A flow that opens carries the call controls in its own header; the card gets out of its way.
    useEffect(() => {
        if (flowOpen) setOpen(false);
    }, [flowOpen]);

    useEffect(() => {
        if (!open) return;
        const onPointer = (event: PointerEvent) => {
            // A ringing call stays up until it is answered, passed or declined.
            if (incomingId !== null) return;
            if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, incomingId]);

    // A phone has no dock; the call sheet carries the call there.
    if (!isEnabled || phone) return null;

    if (incoming) {
        const status = t("pages.agent_workspace.incoming.pill");
        return (
            <span className="agent-dock__phone-wrap" ref={wrapRef}>
                <button
                    type="button"
                    className="agent-dock__phone agent-dock__phone--incoming"
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-label={status}
                    title={status}
                    onClick={() => setOpen((value) => !value)}
                >
                    <span className="agent-dock__phone-icon" aria-hidden="true">
                        <Icon name="phone" size={14} />
                    </span>
                    <span className="agent-dock__phone-label">
                        {status}
                        <span className="agent-dock__phone-caret" aria-hidden="true">
                            ▾
                        </span>
                    </span>
                </button>
                {open ? <AgentIncomingCard variant="popover" /> : null}
            </span>
        );
    }

    if (call) {
        const status = t("pages.agent_workspace.call.on_call");
        return (
            <span className="agent-dock__phone-wrap" ref={wrapRef}>
                <button
                    type="button"
                    className="agent-dock__phone agent-dock__phone--call"
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-label={status}
                    title={status}
                    onClick={() => setOpen((value) => !value)}
                >
                    <span className="agent-dock__phone-icon" aria-hidden="true">
                        <Icon name="phone" size={14} />
                    </span>
                    <span className="agent-dock__phone-label">
                        {connected && elapsed ? (
                            <>
                                {status}
                                {" · "}
                                <span className="agent-dock__phone-time">{elapsed}</span>
                            </>
                        ) : (
                            t(`pages.agent_workspace.call.stage_${call.stage}`)
                        )}
                        <span className="agent-dock__phone-caret" aria-hidden="true">
                            ▾
                        </span>
                    </span>
                </button>
                {open ? <AgentCallCard variant="popover" onCollapse={() => setOpen(false)} /> : null}
            </span>
        );
    }

    const ready = hasLine && isReady;
    const status = ready ? t("pages.agent_workspace.softphone_ready") : t("pages.agent_workspace.softphone_offline");
    return (
        <span
            className={`agent-dock__phone${ready ? "" : " agent-dock__phone--offline"}`}
            role="status"
            aria-label={status}
            title={status}
        >
            <Icon name="phone" size={14} />
            <span className="agent-dock__phone-label">{t("pages.agent_workspace.softphone")}</span>
        </span>
    );
}
