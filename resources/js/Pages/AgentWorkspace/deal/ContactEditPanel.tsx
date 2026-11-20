import { useEffect, useRef } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "@/Pages/Deals/Redesign/context/DealWorkspaceContext";
import { LeadWorkspaceProvider, useLeadWorkspace } from "@/Pages/Leads/Redesign/context/LeadWorkspaceContext";
import useLeadDuplicates from "@/Pages/Leads/Redesign/hooks/useLeadDuplicates";
import type { Lead } from "@/Types/api/leads";
import useAgentMerge from "../contact/useAgentMerge";
import LeadEditPage from "../edit/LeadEditPage";
import type { EditOptions } from "../edit/leadEditForm";

interface ContactEditPanelProps {
    contact: Lead;
    options: EditOptions;
    /** The lead's status as it reads (Qualified, once there is a deal). */
    statusLabel: string;
    /** Switches to the deal's own details dialog. */
    onEditDeal?: () => void;
    onClose: () => void;
}

/**
 * Edit details for the person in the deal state (canvas L8-06). The lead
 * editor runs on its own lead context, seeded from the deal's contact; a save
 * patches the deal's contact too, so the page reads the new values at once.
 * Status is never a field: the qualification outcome set it, and the deal
 * stage moves from the deal.
 */
export default function ContactEditPanel({ contact, ...rest }: ContactEditPanelProps) {
    return (
        <LeadWorkspaceProvider lead={contact}>
            <Editor {...rest} />
        </LeadWorkspaceProvider>
    );
}

function Editor({ options, statusLabel, onEditDeal, onClose }: Omit<ContactEditPanelProps, "contact">) {
    const { t } = useTranslation();
    const { lead } = useLeadWorkspace();
    const { setDeal } = useDealWorkspace();
    const duplicates = useLeadDuplicates(lead.id);
    const afterMerge = useAgentMerge(lead.id);

    // Push each saved version of the lead into the deal's contact.
    const seeded = useRef(lead);
    useEffect(() => {
        if (lead === seeded.current) return;
        seeded.current = lead;
        setDeal((previous) => ({ ...previous, contact: { ...previous.contact, ...lead } as typeof previous.contact }));
    }, [lead, setDeal]);

    const name = lead.client_name || t("pages.agent_workspace.contact.edit.unnamed");

    return (
        <LeadEditPage
            options={options}
            statusLabel={statusLabel}
            duplicates={duplicates}
            onMergedInto={afterMerge}
            onClose={onClose}
            statusNotice={
                <span>
                    <b>{t("pages.agent_workspace.deal.edit.qualified_title", { name })}</b> {t("pages.agent_workspace.deal.edit.qualified_text")}
                </span>
            }
            headerSwitch={
                onEditDeal ? (
                    <span className="agent-edit__switch" role="group" aria-label={t("pages.agent_workspace.deal.edit.switch_aria")}>
                        <button type="button" className="agent-edit__switch-btn" aria-pressed="true">
                            {t("pages.agent_workspace.deal.edit.contact_details")}
                        </button>
                        <button type="button" className="agent-edit__switch-btn" aria-pressed="false" onClick={onEditDeal}>
                            {t("pages.agent_workspace.deal.edit.deal_details")}
                        </button>
                    </span>
                ) : null
            }
        />
    );
}
