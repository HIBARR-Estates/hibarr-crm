import { useMemo, useState } from "react";
import type { Lead } from "@/Types/api/leads";
import type {
    LeadQualification,
    TemplateTree,
} from "@/Types/qualification";
import { getRegistrationService } from "@/Services/RegistrationService";
import { useLeadQualificationService } from "@/Services/LeadQualificationService";
import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import BranchChangeWarningModal from "@/Pages/Leads/Components/Qualification/BranchChangeWarningModal";
import QualificationActionsPanel from "@/Pages/Leads/Components/Qualification/QualificationActionsPanel";
import { useTd } from "@/Hooks/useDynamicTranslation";
import LeadV2Modal, { LeadV2ModalHeader } from "./LeadV2Modal";
import QualifySegmentBody from "./QualifySegmentBody";
import QualifyFooter from "./QualifyFooter";

const LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "de", label: "German" },
    { value: "tr", label: "Turkish" },
    { value: "ru", label: "Russian" },
];

interface QualifyModalProps {
    open: boolean;
    lead: Lead;
    qualification: LeadQualification;
    templateTree: TemplateTree;
    onClose: () => void;
    onCompleted: (qualification: LeadQualification) => void;
    onActionsDone?: (qualification: LeadQualification) => void;
}

export default function QualifyModal({
    open,
    lead,
    qualification,
    templateTree,
    onClose,
    onCompleted,
    onActionsDone,
}: QualifyModalProps) {
    const { td } = useTd();
    const qualificationService = useLeadQualificationService();
    const registrationService = useMemo(() => getRegistrationService(), []);
    const [agentLanguage, setAgentLanguage] = useState(
        qualification.agent_language || "en",
    );
    const [completedQualification, setCompletedQualification] =
        useState<LeadQualification | null>(null);
    const titleId = "qualify-modal-title";

    const finishAndClose = (updated?: LeadQualification | null) => {
        const q = updated ?? completedQualification;
        if (q && onActionsDone) {
            onActionsDone(q);
        }
        onClose();
    };

    const flow = useQualificationFlow({
        lead,
        qualification,
        templateTree,
        service: qualificationService,
        registrationService,
        agentLanguage,
        onQualificationUpdated: (updated) => {
            if (updated.status === "completed") {
                setCompletedQualification(updated);
            }
            onCompleted(updated);
        },
    });

    const showingActions =
        completedQualification != null &&
        (completedQualification.action_runs?.length ?? 0) > 0;

    const segment = flow.currentSegment;
    const showNav = !showingActions && segment?.type !== "outcome";
    const segments = flow.visibleSegments;
    const stepIndex = Math.max(flow.currentIndex, 0);
    const leadName = lead.client_name || td("Lead");

    const stepKindLabel = (() => {
        if (showingActions) return td("Actions");
        if (!segment) return "";
        if (segment.type === "say") return td("Script");
        if (segment.type === "instruction") return td("Instruction");
        if (segment.type === "outcome") return td("Outcome");
        return td("Question");
    })();

    return (
        <>
            <LeadV2Modal
                open={open}
                onClose={() => finishAndClose()}
                labelledBy={titleId}
                ariaLabel={`${td("Qualify")} ${leadName}`}
            >
                <LeadV2ModalHeader
                    title={`${td("Qualify")} ${leadName}`}
                    titleId={titleId}
                    rightSlot={
                        <span className="v2-pill v2-pill-gray">
                            {templateTree.name}
                        </span>
                    }
                    onClose={() => finishAndClose()}
                />

                <div style={{ padding: "14px 20px 0" }}>
                    {!showingActions ? (
                        <div className="v2-progress-track">
                            {segments.map((item, index) => (
                                <div
                                    key={item.key}
                                    className={`v2-progress-seg${
                                        index <= stepIndex ? " is-done" : ""
                                    }`}
                                />
                            ))}
                        </div>
                    ) : null}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--lr-text-dim)",
                            }}
                        >
                            {showingActions
                                ? td("Post-qualification actions")
                                : `${td("Step")} ${Math.min(stepIndex + 1, segments.length || 1)} ${td("of")} ${Math.max(segments.length, 1)}`}
                            {stepKindLabel ? ` · ${stepKindLabel}` : ""}
                        </div>
                        {!showingActions ? (
                            <select
                                className="v2-input"
                                value={agentLanguage}
                                onChange={(e) =>
                                    setAgentLanguage(e.target.value)
                                }
                                style={{
                                    width: "auto",
                                    minWidth: 120,
                                    padding: "6px 10px",
                                    fontSize: 12,
                                }}
                                aria-label={td("Script language")}
                            >
                                {LANGUAGE_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                    </div>
                </div>

                <div
                    className="v2-modal-body"
                    style={{ paddingTop: 20, paddingBottom: 8 }}
                >
                    {showingActions && completedQualification ? (
                        <QualificationActionsPanel
                            lead={lead}
                            qualification={completedQualification}
                            qualificationService={qualificationService}
                            registrationService={registrationService}
                            agentLanguage={agentLanguage}
                            variant="redesign"
                            onUpdated={(updated) => {
                                setCompletedQualification(updated);
                                onCompleted(updated);
                            }}
                            onDone={() => finishAndClose()}
                        />
                    ) : segment ? (
                        <QualifySegmentBody
                            flow={flow}
                            currentSegment={segment}
                            agentLanguage={agentLanguage}
                            onCompletedWithActions={(updated) => {
                                setCompletedQualification(updated);
                                if (!(updated.action_runs?.length)) {
                                    finishAndClose(updated);
                                }
                            }}
                        />
                    ) : (
                        <p
                            style={{
                                margin: 0,
                                color: "var(--lr-text-dim)",
                                fontSize: 13,
                            }}
                        >
                            {td("No steps available for this template.")}
                        </p>
                    )}
                </div>

                <QualifyFooter flow={flow} hidden={!showNav} />
            </LeadV2Modal>

            <BranchChangeWarningModal
                open={Boolean(flow.branchChangePending)}
                onConfirm={() => void flow.confirmBranchChange()}
                onCancel={flow.cancelBranchChange}
                loading={flow.saving}
            />
        </>
    );
}
