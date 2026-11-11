import { useEffect } from "react";
import type { Lead } from "@/Types/api/leads";
import type { LeadQualification } from "@/Types/qualification";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useMeetingTypesForSchedule from "@/Components/Redesign/meeting/useMeetingTypesForSchedule";
import useLeadQualificationWorkspace from "@/Pages/Leads/Redesign/hooks/useLeadQualificationWorkspace";
import {
    LeadWorkspaceProvider,
    useOptionalLeadWorkspace,
} from "@/Pages/Leads/Redesign/context/LeadWorkspaceContext";
import QualifyModal from "./QualifyModal";
import TemplatePickerModal from "./TemplatePickerModal";

// The qualification workspace's own stylesheets. They are normally pulled in by
// the page that hosts them (LeadViewRedesign / the Deals analysis workspace);
// this modal is also mounted from the Tasks workspace, so it brings them.
import "@/Pages/Leads/Redesign/lead-redesign.css";
import "@/Pages/Deals/Redesign/deal-redesign.css";

type QualificationWorkspace = ReturnType<typeof useLeadQualificationWorkspace>;

/** QualifyModal, with a scoped workspace provider when the host page has none. */
function QualifyScriptModal({
    lead,
    workspace,
    meetingTypes,
    onClose,
    onCompleted,
    needsWorkspace,
}: {
    lead: Lead;
    workspace: QualificationWorkspace;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    onClose: () => void;
    onCompleted?: (qualification: LeadQualification) => void;
    needsWorkspace: boolean;
}) {
    const modal = (
        <QualifyModal
            open
            lead={lead}
            qualification={workspace.current}
            templateTree={workspace.templateTree}
            treeLoading={workspace.treeLoading}
            starting={workspace.isStartingFlow}
            meetingTypes={meetingTypes}
            onClose={onClose}
            onCompleted={(qualification) => {
                workspace.handleQualificationUpdated(qualification);
                onCompleted?.(qualification);
            }}
            onActionsDone={(qualification) => {
                // Dismiss after the run is done, then clear the panel — the tree
                // stays cached for the next open.
                workspace.finishQualificationSession(qualification);
                onClose();
            }}
        />
    );

    if (!needsWorkspace) {
        return modal;
    }
    return <LeadWorkspaceProvider lead={lead}>{modal}</LeadWorkspaceProvider>;
}

interface QualifyLaunchModalProps {
    open: boolean;
    /**
     * The lead to qualify. Only `id` is required — the script tokens fall back
     * to empty strings for whatever the caller's payload does not carry, so the
     * Tasks workspace can pass the light lead summary it already has.
     */
    lead: Lead;
    onClose: () => void;
    /** Fired once a run is actually started (template picked). */
    onStarted?: () => void;
    onCompleted?: (qualification: LeadQualification) => void;
}

/**
 * Runs a lead's qualification without navigating away from the current page.
 *
 * Same workspace as the lead page's qualification tab — the existing in-progress
 * run resumes, a finished one shows its recap, otherwise the agent picks a
 * template first. Used from the Tasks workspace, where opening the lead would
 * tear down the page (and, mid-call, the softphone).
 */
export default function QualifyLaunchModal({
    open,
    lead,
    onClose,
    onStarted,
    onCompleted,
}: QualifyLaunchModalProps) {
    const { td } = useTd();
    const workspace = useLeadQualificationWorkspace(lead, { enabled: open });
    // QualifyModal reads lead notes / lead edits through the workspace context.
    // On the lead page that provider already exists; anywhere else (the Tasks
    // workspace) we supply a scoped one rather than fail.
    const inLeadWorkspace = useOptionalLeadWorkspace() !== null;
    // Meeting types are a page prop on the lead route; the Tasks workspace has
    // no such prop, so load them the same way orphan schedule flows do.
    const meetingTypes = useMeetingTypesForSchedule(undefined, open);

    const qualifyOpen = open && workspace.phase === "inProgress";
    const recapOpen = open && workspace.phase === "completed";
    // Anything else (no run yet, or the bootstrap fetch still in flight) asks
    // which script to run.
    const pickerOpen = open && !qualifyOpen && !recapOpen;

    // Collapse when the caller closes us, so reopening starts from the picker
    // again instead of a stale panel.
    useEffect(() => {
        if (!open) {
            workspace.handleStartNew();
        }
        // Only react to the open flag — handleStartNew is stable enough and
        // re-running on workspace churn would wipe a loaded tree.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
        <>
            <TemplatePickerModal
                open={pickerOpen}
                leadName={
                    lead.client_name ?? lead.client_name_salutation ?? td("Lead", { source: "en" })
                }
                templates={workspace.templates}
                loading={workspace.templatesLoading}
                selecting={workspace.isStartingFlow}
                onClose={onClose}
                onSelect={(templateId) => {
                    void workspace.startQualificationScript(templateId).then((started) => {
                        if (started) {
                            onStarted?.();
                        }
                    });
                }}
            />

            {(qualifyOpen || recapOpen) && (
                <QualifyScriptModal
                    lead={lead}
                    workspace={workspace}
                    meetingTypes={meetingTypes}
                    onClose={onClose}
                    onCompleted={onCompleted}
                    needsWorkspace={!inLeadWorkspace}
                />
            )}
        </>
    );
}