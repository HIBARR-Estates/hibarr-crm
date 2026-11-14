import { useEffect, useState, type ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "../../primitives/Icon";
import AgentCallStrip from "../call/AgentCallStrip";
import { useRegisterOpenFlow } from "../call/agentCallBridge";
import "./agent-flow.css";

interface FlowPanelHeaderProps {
    /** id for the dialog's aria-labelledby. */
    titleId: string;
    /** The person's name, for the avatar's initials. */
    name: string;
    /** "Qualification · Jana Hoffmann". */
    title: string;
    /** Script name, step and save note, already joined. */
    subtitle: string;
    /** The flow's save signal, as AnalysisHeaderBar takes it. */
    subscribeSaving?: (cb: (saving: boolean) => void) => () => void;
    /** Controls the flow already has (script language, focus mode). */
    trailing?: ReactNode;
    /** The lead the flow is about; a call to them shows its controls in the header. */
    leadId?: number | null;
    onClose: () => void;
}

/**
 * Header of a qualification or deal analysis opened under the agent dock
 * (canvas L7-07, L7-12): the person's initials, what is running for whom,
 * where the script stands, the call controls while the person is on the phone
 * with them, and the close button. White, so the dock above
 * stays the darkest thing on screen.
 */
export default function FlowPanelHeader({ titleId, name, title, subtitle, subscribeSaving, trailing, leadId, onClose }: FlowPanelHeaderProps) {
    const { t } = useTranslation();
    useRegisterOpenFlow();
    const [saving, setSaving] = useState(false);
    useEffect(() => subscribeSaving?.(setSaving), [subscribeSaving]);

    return (
        <header className="agent-flow__head">
            <span className="agent-flow__avatar" aria-hidden="true">
                {initials(name)}
            </span>
            <div className="agent-flow__heading">
                <h2 id={titleId} className="agent-flow__title">
                    {title}
                </h2>
                <p className="agent-flow__sub">
                    {subtitle}
                    {saving ? <span className="agent-flow__saving"> · {t("pages.agent_workspace.flow.saving")}</span> : null}
                </p>
            </div>
            {trailing ? <div className="agent-flow__trailing">{trailing}</div> : null}
            <AgentCallStrip leadId={leadId} />
            <button type="button" className="agent-flow__close" aria-label={t("pages.agent_workspace.flow.close")} onClick={onClose}>
                <Icon name="x" size={18} />
            </button>
        </header>
    );
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
}
