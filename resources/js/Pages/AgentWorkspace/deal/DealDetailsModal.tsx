import { useEffect, useState } from "react";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import useTranslation from "@/Hooks/useTranslation";
import { useDealWorkspace } from "@/Pages/Deals/Redesign/context/DealWorkspaceContext";
import { highlightDealField } from "@/Pages/Deals/Redesign/adapters/highlightDealField";
import DealInfoTab from "@/Pages/Deals/Redesign/components/tabs/DealInfoTab";
import type { DealWorkspaceModel } from "@/Pages/Deals/Redesign/hooks/useDealWorkspaceModel";
import type { DealInfoSectionId, DealShowProps } from "@/Pages/Deals/Redesign/types";

export interface DealDetailsTarget {
    section: DealInfoSectionId;
    /** A field to scroll to and flash once its section is open. */
    fieldKey?: string;
}

interface DealDetailsModalProps {
    /** Null while closed. */
    target: DealDetailsTarget | null;
    onClose: () => void;
    props: DealShowProps;
    model: DealWorkspaceModel;
    showCompletionDot: boolean;
}

/**
 * Deal details: every field of the deal and of the person in the deal's own
 * sections, edited in place, in a dialog over the page. Edit details opens it,
 * and so does a stage condition that needs a field filled in. It is the deal
 * page's Deal info tab, so the same fields and rules apply.
 */
export default function DealDetailsModal({ target, onClose, props, model, showCompletionDot }: DealDetailsModalProps) {
    const { t } = useTranslation();
    // The live deal: edits patch the workspace, not the page props.
    const { deal } = useDealWorkspace();
    const [section, setSection] = useState<DealInfoSectionId>("general");

    useEffect(() => {
        if (!target) return;
        setSection(target.section);
        if (target.fieldKey) highlightDealField(target.fieldKey);
    }, [target]);

    return (
        <Modal open={target !== null} title={t("pages.agent_workspace.deal.details.title")} onClose={onClose} maxWidth={1040} closeOnBackdrop>
            {target ? (
                <DealInfoTab
                    deal={deal}
                    customFieldCategories={model.dealInfoCategories}
                    visibleFieldKeys={model.dealInfoFieldKeys}
                    fields={model.fields}
                    activeSection={section}
                    onSectionChange={setSection}
                    restrictPackageOrProperty={props.restrictPackageOrProperty}
                    consents={props.consents}
                    gdprSetting={props.gdprSetting}
                    showCompletionDot={showCompletionDot}
                />
            ) : null}
        </Modal>
    );
}
