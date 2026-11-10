import { usePage } from "@inertiajs/react";
import { App, message } from "antd";
import type { PageProps } from "@/Components/DashboardLayout";
import ClickToCallButton from "@/Components/ClickToCallButton";
import useClickToCall from "@/Hooks/useClickToCall";
import useSoftphone, { canMakeSoftphoneCalls } from "@/Hooks/useSoftphone";
import useTranslation from "@/Hooks/useTranslation";
import Button from "../primitives/Button";
import Icon from "../primitives/Icon";

interface AgentCallButtonProps {
    /** The number to dial; empty when the person has none (the button then says so). */
    phone: string;
    /** What the call is logged against. */
    entity: { type: "lead" | "deal"; id: number };
    /** Button text; "Call" by default. */
    label?: string;
    className?: string;
}

/**
 * Dials through the softphone or the click-to-call bridge, whichever the CRM
 * has for this agent (the same check as the lead page's quick actions).
 * Renders nothing when neither is set up, like there.
 */
export default function AgentCallButton({ phone, entity, label, className = "" }: AgentCallButtonProps) {
    const { t } = useTranslation();
    const { props } = usePage<PageProps>();
    const { message: appMessage } = App.useApp();
    const toast = appMessage ?? message;
    const { isEnabled: olEnabled } = useClickToCall();
    const { isEnabled: softphoneFeatureEnabled } = useSoftphone();

    const softphoneEnabled = softphoneFeatureEnabled && props.featureFlags?.["crm.softphone"] === true;
    const canUseLine = (softphoneEnabled && canMakeSoftphoneCalls(props.auth?.user, props.auth?.permissions)) || olEnabled;
    if (!canUseLine) return null;

    const content = (
        <>
            <Icon name="phone" size={14} />
            {label ?? t("pages.agent_workspace.contact.call")}
        </>
    );

    if (!phone.trim()) {
        return (
            <Button
                variant="call"
                className={className}
                title={t("pages.leads.quick_actions.no_phone")}
                onClick={() => toast.warning(t("pages.leads.quick_actions.no_phone"))}
            >
                {content}
            </Button>
        );
    }

    return (
        <ClickToCallButton
            phone={phone.trim()}
            entity={entity}
            variant="link"
            className={`dr-btn dr-btn-call ${className}`.trim()}
            title={t("pages.leads.quick_actions.call_title")}
            ariaLabel={t("pages.leads.quick_actions.call_title")}
            dataAction="call"
        >
            {content}
        </ClickToCallButton>
    );
}
