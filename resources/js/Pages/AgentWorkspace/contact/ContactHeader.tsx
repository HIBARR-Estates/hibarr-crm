import type { ReactNode } from "react";
import { usePage } from "@inertiajs/react";
import { App, Dropdown, message, type MenuProps } from "antd";
import type { PageProps } from "@/Components/DashboardLayout";
import ClickToCallButton from "@/Components/ClickToCallButton";
import { initialsFromName } from "@/Components/Redesign";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useClickToCall from "@/Hooks/useClickToCall";
import useSoftphone, { canMakeSoftphoneCalls } from "@/Hooks/useSoftphone";
import useTranslation from "@/Hooks/useTranslation";
import { getDossierFieldValue, isMeaningfulDossierValue } from "@/Pages/Leads/Redesign/adapters/dossierAdapter";
import LeadAvatarButton from "@/Pages/Leads/Redesign/components/header/LeadAvatarButton";
import MoreMenu from "@/Pages/Leads/Redesign/components/header/MoreMenu";
import type { LeadCreateKind } from "@/Pages/Leads/Redesign/components/workspace/LeadCreateModals";
import { formatLeadTemperature } from "@/Pages/Leads/Redesign/config/leadTemperature";
import type { MoreMenuActionId } from "@/Pages/Leads/Redesign/config/moreMenuItems";
import type { Lead } from "@/Types/api/leads";

const TEMPERATURE_PILL: Record<string, string> = { hot: "red", warm: "amber", cold: "blue" };

interface ContactHeaderProps {
    lead: Lead;
    canEdit: boolean;
    canDelete: boolean;
    canFindDuplicates: boolean;
    onCreate: (kind: LeadCreateKind) => void;
    allowedCreate: Partial<Record<LeadCreateKind, boolean>>;
    onEdit: () => void;
    onMoreAction: (id: MoreMenuActionId) => void;
}

/**
 * Who this is and what you can do: avatar, name, temperature, a line of
 * the facts an agent needs before calling, then Call, New activity, Edit
 * details and the lead's ⋯ menu. Sticky on a phone.
 */
export default function ContactHeader({
    lead,
    canEdit,
    canDelete,
    canFindDuplicates,
    onCreate,
    allowedCreate,
    onEdit,
    onMoreAction,
}: ContactHeaderProps) {
    const { t } = useTranslation();
    const { props } = usePage<PageProps>();
    const viewerId = props.auth?.user?.id;

    const owner = lead.lead_owner;
    const ownerText = !owner
        ? t("pages.agent_workspace.contact.no_owner")
        : owner.id === viewerId
          ? t("pages.agent_workspace.contact.owner_you")
          : t("pages.agent_workspace.contact.owner_name", { name: owner.name ?? "" });
    const field = (key: Parameters<typeof getDossierFieldValue>[1]) => {
        const raw = getDossierFieldValue(lead, key);
        return isMeaningfulDossierValue(raw) ? raw.trim() : "";
    };
    const bestTime = field("preferredContactTime");
    const meta = [
        ownerText,
        field("city"),
        field("languages"),
        bestTime ? t("pages.agent_workspace.contact.best_time", { time: bestTime }) : "",
    ].filter(Boolean);

    const temperature = lead.temperature ?? null;

    return (
        <header className="agent-contact__header">
            <div className="agent-contact__who">
                <LeadAvatarButton
                    name={lead.client_name ?? ""}
                    image={lead.image}
                    imageUrl={lead.image_url}
                    initials={initialsFromName(lead.client_name)}
                    canUpload={canEdit}
                />
                <div className="agent-contact__identity">
                    <div className="agent-contact__name-row">
                        <h1 className="agent-contact__name">{lead.client_name_salutation || lead.client_name}</h1>
                        {temperature ? (
                            <span className={`dr-pill dr-pill-${TEMPERATURE_PILL[temperature] ?? "gray"}`}>
                                {formatLeadTemperature(temperature)}
                            </span>
                        ) : null}
                    </div>
                    {meta.length > 0 ? <p className="agent-contact__meta">{meta.join(" · ")}</p> : null}
                </div>
            </div>
            <div className="agent-contact__actions">
                <CallButton lead={lead} />
                <NewActivityButton onCreate={onCreate} allowed={allowedCreate} />
                {canEdit ? (
                    <Button variant="ghost" onClick={onEdit}>
                        <Icon name="edit" size={14} />
                        {t("pages.agent_workspace.contact.edit_details")}
                    </Button>
                ) : null}
                <MoreMenu onAction={onMoreAction} canDelete={canDelete} canFindDuplicates={canFindDuplicates} />
            </div>
        </header>
    );
}

/**
 * One "New activity" button for every kind of record (task, meeting, note, a
 * logged activity), each opening the lead page's own create form.
 */
export function NewActivityButton({
    onCreate,
    allowed,
    size = "base",
    variant = "primary",
}: {
    onCreate: (kind: LeadCreateKind) => void;
    /** Kinds the viewer may not create are left out (permissions). */
    allowed?: Partial<Record<LeadCreateKind, boolean>>;
    size?: "base" | "sm";
    variant?: "primary" | "ghost";
}) {
    const { t } = useTranslation();
    const all: Array<{ key: LeadCreateKind; icon: ReactNode; label: string }> = [
        { key: "task", icon: <Icon name="check-square" size={14} />, label: t("pages.agent_workspace.contact.new_task") },
        { key: "meeting", icon: <Icon name="calendar" size={14} />, label: t("pages.agent_workspace.contact.new_meeting") },
        { key: "note", icon: <Icon name="file-text" size={14} />, label: t("pages.agent_workspace.contact.new_note") },
        { key: "log", icon: <Icon name="activity" size={14} />, label: t("pages.agent_workspace.contact.log_activity") },
    ];
    const items: MenuProps["items"] = all.filter((item) => allowed?.[item.key] !== false);
    if (items.length === 0) return null;

    return (
        <Dropdown
            menu={{ items, onClick: ({ key }) => onCreate(key as LeadCreateKind) }}
            trigger={["click"]}
            placement="bottomRight"
        >
            {/* antd positions the menu from a DOM node; the span gives it one. */}
            <span className="agent-contact__menu-anchor">
                <Button variant={variant} size={size} aria-haspopup="menu">
                    <Icon name="plus" size={size === "sm" ? 12 : 14} />
                    {t("pages.agent_workspace.contact.new_activity")}
                    <Icon name="chevron-down" size={size === "sm" ? 12 : 14} />
                </Button>
            </span>
        </Dropdown>
    );
}

/**
 * Dials through the softphone or the click-to-call bridge, whichever the
 * CRM has for this agent (the same check as the lead page's quick actions).
 * Hidden when neither is set up, like there.
 */
function CallButton({ lead }: { lead: Lead }) {
    const { t } = useTranslation();
    const { props } = usePage<PageProps>();
    const { message: appMessage } = App.useApp();
    const toast = appMessage ?? message;
    const { isEnabled: olEnabled } = useClickToCall();
    const { isEnabled: softphoneFeatureEnabled } = useSoftphone();

    const raw = getDossierFieldValue(lead, "mobile");
    const phone = raw && isMeaningfulDossierValue(raw) ? raw.trim() : "";
    const softphoneEnabled = softphoneFeatureEnabled && props.featureFlags?.["crm.softphone"] === true;
    const canUseLine = (softphoneEnabled && canMakeSoftphoneCalls(props.auth?.user, props.auth?.permissions)) || olEnabled;
    if (!canUseLine) return null;

    const content = (
        <>
            <Icon name="phone" size={14} />
            {t("pages.agent_workspace.contact.call")}
        </>
    );

    if (!phone) {
        return (
            <Button
                variant="call"
                title={t("pages.leads.quick_actions.no_phone")}
                onClick={() => toast.warning(t("pages.leads.quick_actions.no_phone"))}
            >
                {content}
            </Button>
        );
    }

    return (
        <ClickToCallButton
            phone={phone}
            entity={{ type: "lead", id: lead.id }}
            variant="link"
            className="dr-btn dr-btn-call"
            title={t("pages.leads.quick_actions.call_title")}
            ariaLabel={t("pages.leads.quick_actions.call_title")}
            dataAction="call"
        >
            {content}
        </ClickToCallButton>
    );
}
