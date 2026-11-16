import { useEffect, useState } from "react";
import { initialsOf } from "@/Components/Softphone/dock/utils";
import { useIncomingCall, type IncomingCallView } from "@/Components/Softphone/dock/incomingCallBridge";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import Icon from "../../primitives/Icon";
import { agoText, meetingText, ringClock } from "./incomingFormat";
import useCallerGlance from "./useCallerGlance";
import "./agent-call.css";

interface AgentIncomingCardProps {
    /** "popover" under the dock's pill; "sheet" above the tab bar on a phone. */
    variant: "popover" | "sheet";
}

/** The ringing timer: ticks once a second while the card is up. */
function useRingClock(startedAt: number): string {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);
    return ringClock(startedAt, now);
}

/**
 * A call ringing in (canvas L7-13 and, for a number the agent may not see,
 * L7-31). Answer, Pass on and Decline are the softphone's own actions; who is
 * calling comes from the lead match the dock already runs, and the status,
 * open deal and "why they might call" are loaded in the background.
 *
 * Held back: the mute-ring toggle and the Calls ON/OFF switch of the classic
 * ringing panel (not on the board), and the board's "reservation agreement
 * sent Fri" line, which no CRM record backs.
 */
export default function AgentIncomingCard({ variant }: AgentIncomingCardProps) {
    const incoming = useIncomingCall();
    if (!incoming) return null;
    return <IncomingBody incoming={incoming} variant={variant} />;
}

function IncomingBody({ incoming, variant }: { incoming: IncomingCallView; variant: "popover" | "sheet" }) {
    const { t, locale } = useTranslation();
    const { timezone } = useUserDateTime();
    const clock = useRingClock(incoming.startedAt);
    const { glance, loading } = useCallerGlance(incoming.leadId);
    const nowMs = Date.now();

    const known = incoming.leadId !== null && incoming.name !== "";
    const anonymous = incoming.hidden || incoming.unmatched || incoming.multiple !== null || !known;

    const reasons: string[] = [];
    if (glance?.next_meeting) {
        reasons.push(meetingText(glance.next_meeting.title, glance.next_meeting.at, nowMs, timezone, locale, t));
    }
    if (glance?.last_touch_at) {
        reasons.push(t("pages.agent_workspace.incoming.last_touch", { ago: agoText(glance.last_touch_at, nowMs, locale) }));
    }

    const subline = incoming.hidden
        ? t("pages.agent_workspace.incoming.not_yours")
        : incoming.multiple !== null
          ? t("pages.agent_workspace.incoming.several", { count: incoming.multiple })
          : incoming.unmatched
            ? t("pages.agent_workspace.incoming.unknown")
            : known && incoming.ownLead
              ? `${incoming.peer} · ${t("pages.agent_workspace.incoming.your_lead")}`
              : incoming.peer;

    const dealValue = glance?.deal?.value != null ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(glance.deal.value) : null;
    const dealParts = [
        t("pages.agent_workspace.incoming.deal"),
        glance?.deal?.stage ?? null,
        dealValue !== null ? `${glance?.deal?.currency ? `${glance.deal.currency} ` : ""}${dealValue}` : null,
    ].filter(Boolean);

    return (
        <div
            className={`agent-call agent-call--incoming agent-call--${variant}`}
            role="dialog"
            aria-label={t("pages.agent_workspace.incoming.card_label")}
        >
            <div className="agent-incoming__top">
                <span className="agent-incoming__cap">
                    {t("pages.agent_workspace.incoming.ringing")} <span className="agent-incoming__clock">{clock}</span>
                </span>
                <span className="agent-incoming__line">
                    {incoming.line === "own" ? t("pages.agent_workspace.incoming.line_own") : t("pages.agent_workspace.incoming.line_pool")}
                </span>
            </div>

            <div className="agent-call__head">
                <span
                    className={`agent-incoming__avatar${anonymous ? " agent-incoming__avatar--anon" : ""}`}
                    aria-hidden="true"
                >
                    {anonymous ? "?" : initialsOf(incoming.name, incoming.peer)}
                </span>
                <div className="agent-call__who">
                    <b className={`agent-call__name${anonymous ? " agent-incoming__number" : ""}`}>
                        {anonymous ? incoming.peer : incoming.name}
                    </b>
                    <span className="agent-call__sub">{subline}</span>
                </div>
            </div>

            {known && (loading || glance?.status || glance?.deal) ? (
                <div className="agent-incoming__chips">
                    {glance?.status ? (
                        <span
                            className="agent-incoming__status"
                            style={glance.status.color ? ({ "--tag": glance.status.color } as React.CSSProperties) : undefined}
                        >
                            {t("pages.agent_workspace.incoming.lead")} · {glance.status.label}
                        </span>
                    ) : loading ? (
                        <span className="agent-incoming__chip-skeleton" aria-hidden="true" />
                    ) : null}
                    {glance?.deal ? (
                        <span className="agent-incoming__deal">
                            <span
                                className="agent-incoming__deal-mark"
                                style={glance.deal.stage_color ? ({ "--stage": glance.deal.stage_color } as React.CSSProperties) : undefined}
                                aria-hidden="true"
                            />
                            {dealParts.join(" · ")}
                        </span>
                    ) : null}
                </div>
            ) : null}

            {known && reasons.length > 0 ? (
                <p className="agent-incoming__why">
                    <b>{t("pages.agent_workspace.incoming.why")}</b> {reasons.join(" · ")}
                </p>
            ) : null}

            {incoming.hidden ? (
                <p className="agent-incoming__lock">
                    <Icon name="lock" size={12} />
                    <span>{t("pages.agent_workspace.incoming.lock_note")}</span>
                </p>
            ) : null}

            <div className="agent-incoming__actions">
                <button type="button" className="agent-incoming__btn agent-incoming__btn--answer" onClick={incoming.answer}>
                    {t("pages.agent_workspace.incoming.answer")}
                </button>
                {incoming.canPass ? (
                    <button type="button" className="agent-incoming__btn" onClick={incoming.pass}>
                        {t("pages.agent_workspace.incoming.pass_on")}
                    </button>
                ) : null}
                <button type="button" className="agent-incoming__btn agent-incoming__btn--decline" onClick={incoming.decline}>
                    {t("pages.agent_workspace.incoming.decline")}
                </button>
            </div>
        </div>
    );
}
