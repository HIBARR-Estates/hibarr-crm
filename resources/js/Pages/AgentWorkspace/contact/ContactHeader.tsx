import type { ReactNode } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import AgentCallButton from "@/Components/Redesign/agent/AgentCallButton";
import { initialsFromName } from "@/Components/Redesign";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import { getDossierFieldValue, isMeaningfulDossierValue } from "@/Pages/Leads/Redesign/adapters/dossierAdapter";
import LeadAvatarButton from "@/Pages/Leads/Redesign/components/header/LeadAvatarButton";
import MoreMenu from "@/Pages/Leads/Redesign/components/header/MoreMenu";
import { NewActivityButton, type ExtraActivity } from "./NewActivityButton";
import type { LeadCreateKind } from "@/Pages/Leads/Redesign/components/workspace/LeadCreateModals";
import { formatLeadTemperature } from "@/Pages/Leads/Redesign/config/leadTemperature";
import type { MoreMenuActionId } from "@/Pages/Leads/Redesign/config/moreMenuItems";
import type { Lead } from "@/Types/api/leads";

export type { ExtraActivity };
export { NewActivityButton };

const TEMPERATURE_PILL: Record<string, string> = { hot: "red", warm: "amber", cold: "blue" };

interface ContactHeaderProps {
    lead: Lead;
    canEdit: boolean;
    canDelete: boolean;
    canFindDuplicates: boolean;
    onCreate: (kind: LeadCreateKind) => void;
    allowedCreate: Partial<Record<LeadCreateKind, boolean>>;
    /** Edit details; left out when the viewer can't edit. */
    onEdit: () => void;
    /** The lead's ⋯ menu. Left out in the deal state, whose menu sits on the deal. */
    onMoreAction?: (id: MoreMenuActionId) => void;
    /** Replaces the lead's ⋯ menu (the deal state's own). */
    moreMenu?: ReactNode;
    /** Further entries in the New activity menu (Email). */
    extraActivities?: ExtraActivity[];
    /** What a call is logged against: the lead, or the deal in the deal state. */
    callEntity?: { type: "lead" | "deal"; id: number };
    /**
     * A plain avatar, without the photo preview and upload: those need the
     * lead page's context, which the deal state doesn't have.
     */
    staticAvatar?: boolean;
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
    moreMenu,
    extraActivities,
    callEntity,
    staticAvatar = false,
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
                {!staticAvatar ? (
                    <LeadAvatarButton
                        name={lead.client_name ?? ""}
                        image={lead.image}
                        imageUrl={lead.image_url}
                        initials={initialsFromName(lead.client_name)}
                        canUpload={canEdit}
                    />
                ) : (
                    <div className="v2-lead-avatar-wrap">
                        <div className="v2-lead-avatar-shell">
                            <span className="v2-lead-avatar" aria-hidden="true">
                                {lead.image && lead.image_url ? (
                                    <img src={lead.image_url} alt="" className="v2-lead-avatar__img" />
                                ) : (
                                    <span className="v2-lead-avatar__initials">{initialsFromName(lead.client_name)}</span>
                                )}
                            </span>
                        </div>
                    </div>
                )}
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
                <AgentCallButton phone={leadPhone(lead)} entity={callEntity ?? { type: "lead", id: lead.id }} />
                <NewActivityButton onCreate={onCreate} allowed={allowedCreate} extra={extraActivities} />
                {canEdit ? (
                    <Button variant="ghost" onClick={onEdit}>
                        <Icon name="edit" size={14} />
                        {t("pages.agent_workspace.contact.edit_details")}
                    </Button>
                ) : null}
                {moreMenu ??
                    (onMoreAction ? (
                        <MoreMenu onAction={onMoreAction} canDelete={canDelete} canFindDuplicates={canFindDuplicates} />
                    ) : null)}
            </div>
        </header>
    );
}

/** The lead's mobile, formatted for dialling; empty when there is none. */
export function leadPhone(lead: Lead): string {
    const raw = getDossierFieldValue(lead, "mobile");
    return raw && isMeaningfulDossierValue(raw) ? raw.trim() : "";
}
