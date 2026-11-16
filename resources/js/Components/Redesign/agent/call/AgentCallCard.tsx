import { router, usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import useTranslation from "@/Hooks/useTranslation";
import { initialsOf } from "@/Components/Softphone/dock/utils";
import Icon from "../../primitives/Icon";
import { requestResumeQualification, useFlowOpen } from "./agentCallBridge";
import useAgentCall from "./useAgentCall";
import "./agent-call.css";

interface AgentCallCardProps {
    /** "popover" under the dock's pill; "sheet" above the tab bar on a phone. */
    variant: "popover" | "sheet";
    onCollapse: () => void;
}

/**
 * The call card (canvas L7-06): who the call is with, its running time, Mute,
 * Hold and End, and a way back into the qualification the call belongs to.
 * Shown from the dock's pill while a call runs.
 *
 * Held back because the CRM has nothing behind them yet: Keypad (the softphone
 * sends no DTMF), Pass on for an outbound call, and the quick note saved to the call.
 */
export default function AgentCallCard({ variant, onCollapse }: AgentCallCardProps) {
    const { t } = useTranslation();
    const { props, url } = usePage<PageProps>();
    const { call, connected, elapsed, toggleMute, toggleHold, end } = useAgentCall();
    const flowOpen = useFlowOpen();
    if (!call) return null;

    const leadId = call.context?.leadId ?? null;
    const name = call.context?.leadName?.trim() ?? "";
    const leadHref = leadId ? route("agent.people.show", { lead: leadId }) : null;
    const showContinue = Boolean(leadId) && !flowOpen && props.featureFlags?.["crm.lead-qualification-tab"] === true;

    const openQualification = () => {
        if (!leadId || !leadHref) return;
        requestResumeQualification(leadId);
        // On the person's own page the page itself picks the request up; elsewhere go there first.
        if (url.split("?")[0] !== leadHref.replace(/^https?:\/\/[^/]+/, "")) {
            router.visit(leadHref);
        }
        onCollapse();
    };

    return (
        <div
            className={`agent-call agent-call--${variant}`}
            role="dialog"
            aria-label={t("pages.agent_workspace.call.card_label")}
        >
            <div className="agent-call__head">
                <span className="agent-call__avatar" aria-hidden="true">
                    {name ? initialsOf(name, call.peer) : <Icon name="phone" size={16} />}
                </span>
                <div className="agent-call__who">
                    {name && leadHref ? (
                        <a
                            className="agent-call__name"
                            href={leadHref}
                            onClick={(event) => {
                                event.preventDefault();
                                router.visit(leadHref);
                            }}
                        >
                            {name}
                        </a>
                    ) : (
                        <b className="agent-call__name">{call.peer}</b>
                    )}
                    {name ? <span className="agent-call__sub">{call.peer}</span> : null}
                </div>
                <span className="agent-call__time" role="timer">
                    {connected && elapsed ? elapsed : t(`pages.agent_workspace.call.stage_${call.stage}`)}
                </span>
            </div>

            <div className="agent-call__controls">
                <button type="button" className="agent-call__btn" aria-pressed={call.muted} onClick={toggleMute}>
                    {call.muted ? t("pages.agent_workspace.call.unmute") : t("pages.agent_workspace.call.mute")}
                </button>
                <button
                    type="button"
                    className="agent-call__btn"
                    aria-pressed={call.onHold}
                    disabled={!connected}
                    onClick={toggleHold}
                >
                    {call.onHold ? t("pages.agent_workspace.call.resume") : t("pages.agent_workspace.call.hold")}
                </button>
                <button type="button" className="agent-call__btn agent-call__btn--end" onClick={end}>
                    {t("pages.agent_workspace.call.end")}
                </button>
            </div>

            <div className="agent-call__foot">
                {showContinue ? (
                    <button type="button" className="agent-call__continue" onClick={openQualification}>
                        <span aria-hidden="true">▶</span>
                        {t("pages.agent_workspace.call.continue_qualification")}
                    </button>
                ) : null}
                <button type="button" className="agent-call__collapse" onClick={onCollapse}>
                    <span aria-hidden="true">▴</span>
                    {t("pages.agent_workspace.call.collapse")}
                </button>
            </div>
        </div>
    );
}
