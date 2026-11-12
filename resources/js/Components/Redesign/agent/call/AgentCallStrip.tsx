import useTranslation from "@/Hooks/useTranslation";
import useAgentCall from "./useAgentCall";
import "./agent-call.css";

/**
 * The call, folded into the header of a qualification or analysis (canvases
 * L7-07, L7-12): a green strip with the running time and Mute, Hold and End,
 * so the agent never leaves the script to control the call. Only for a call
 * to this lead; renders nothing otherwise.
 */
export default function AgentCallStrip({ leadId }: { leadId: number | null | undefined }) {
    const { t } = useTranslation();
    const { call, connected, elapsed, toggleMute, toggleHold, end } = useAgentCall();
    if (!call || !leadId || call.context?.leadId !== leadId) return null;

    return (
        <div className="agent-call-strip" role="group" aria-label={t("pages.agent_workspace.call.on_this_call")}>
            <span className="agent-call-strip__dot" aria-hidden="true" />
            <span className="agent-call-strip__text">
                {t("pages.agent_workspace.call.on_this_call")}
                {connected && elapsed ? (
                    <>
                        {" · "}
                        <span className="agent-call-strip__time" role="timer">
                            {elapsed}
                        </span>
                    </>
                ) : (
                    <> · {t(`pages.agent_workspace.call.stage_${call.stage}`)}</>
                )}
            </span>
            <button type="button" className="agent-call-strip__btn" aria-pressed={call.muted} onClick={toggleMute}>
                {call.muted ? t("pages.agent_workspace.call.unmute") : t("pages.agent_workspace.call.mute")}
            </button>
            <button
                type="button"
                className="agent-call-strip__btn"
                aria-pressed={call.onHold}
                disabled={!connected}
                onClick={toggleHold}
            >
                {call.onHold ? t("pages.agent_workspace.call.resume") : t("pages.agent_workspace.call.hold")}
            </button>
            <button type="button" className="agent-call-strip__btn agent-call-strip__btn--end" onClick={end}>
                {t("pages.agent_workspace.call.end")}
            </button>
        </div>
    );
}
