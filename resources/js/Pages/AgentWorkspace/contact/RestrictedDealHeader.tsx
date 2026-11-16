import type { ReactNode } from "react";
import { initialsFromName } from "@/Components/Redesign";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadCreateKind } from "@/Pages/Leads/Redesign/components/workspace/LeadCreateModals";
import { NewActivityButton, type ExtraActivity } from "./ContactHeader";

export interface LeadRestriction {
    /** Who owns the lead, when it has an owner. */
    owner_name: string | null;
    /** Whether the viewer created the deal. */
    created_by_me: boolean;
}

interface RestrictedDealHeaderProps {
    name: string;
    restriction: LeadRestriction;
    canEdit: boolean;
    onEdit: () => void;
    onCreate: (kind: LeadCreateKind) => void;
    allowedCreate: Partial<Record<LeadCreateKind, boolean>>;
    extraActivities?: ExtraActivity[];
}

/**
 * The header of a deal whose lead is not the viewer's (canvas L7-30): whose
 * deal this is, who owns the lead, and the actions that belong to the deal.
 * There is no number to call and no lead menu: the lead's details are not here.
 */
export default function RestrictedDealHeader({ name, restriction, canEdit, onEdit, onCreate, allowedCreate, extraActivities }: RestrictedDealHeaderProps) {
    const { t } = useTranslation();
    const meta: ReactNode = restriction.owner_name
        ? t("pages.agent_workspace.deal.restricted.meta", { owner: restriction.owner_name })
        : t("pages.agent_workspace.deal.restricted.meta_no_owner");

    return (
        <header className="agent-contact__header">
            <div className="agent-contact__who">
                <div className="v2-lead-avatar-wrap">
                    <div className="v2-lead-avatar-shell">
                        <span className="v2-lead-avatar" aria-hidden="true">
                            <span className="v2-lead-avatar__initials">{initialsFromName(name)}</span>
                        </span>
                    </div>
                </div>
                <div className="agent-contact__identity">
                    <div className="agent-contact__name-row">
                        <h1 className="agent-contact__name">{name}</h1>
                        {restriction.created_by_me ? (
                            <span className="agent-restricted__chip">
                                <span aria-hidden="true" />
                                {t("pages.agent_workspace.deal.restricted.created_by_you")}
                            </span>
                        ) : null}
                    </div>
                    <p className="agent-contact__meta agent-restricted__meta">{meta}</p>
                </div>
            </div>
            <div className="agent-contact__actions">
                <Button variant="call" disabled>
                    <Icon name="phone" size={14} />
                    {t("pages.agent_workspace.deal.restricted.call_hidden")}
                </Button>
                <NewActivityButton onCreate={onCreate} allowed={allowedCreate} extra={extraActivities} />
                {canEdit ? (
                    <Button variant="ghost" onClick={onEdit}>
                        <Icon name="edit" size={14} />
                        {t("pages.agent_workspace.deal.restricted.edit_deal")}
                    </Button>
                ) : null}
            </div>
        </header>
    );
}
