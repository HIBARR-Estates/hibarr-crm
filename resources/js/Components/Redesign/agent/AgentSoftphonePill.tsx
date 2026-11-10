import useSoftphone from "@/Hooks/useSoftphone";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "../primitives/Icon";

/**
 * The dock's softphone pill: the line's state at a glance (ready, on a call,
 * not connected). Calls themselves still run in the softphone dock; the pill
 * becomes its dropdown in the softphone branch. Hidden without the softphone
 * flag; without a line it shows as not connected.
 */
export default function AgentSoftphonePill() {
    const { t } = useTranslation();
    const { isEnabled, hasLine, isReady, state } = useSoftphone();
    if (!isEnabled) return null;

    const onCall = Boolean(state.call);
    const ready = hasLine && isReady;
    const status = onCall
        ? t("pages.agent_workspace.softphone_on_call")
        : ready
          ? t("pages.agent_workspace.softphone_ready")
          : t("pages.agent_workspace.softphone_offline");

    return (
        <span
            className={`agent-dock__phone${ready || onCall ? "" : " agent-dock__phone--offline"}`}
            role="status"
            aria-label={status}
            title={status}
        >
            <Icon name="phone" size={14} />
            <span className="agent-dock__phone-label">{onCall ? status : t("pages.agent_workspace.softphone")}</span>
        </span>
    );
}
