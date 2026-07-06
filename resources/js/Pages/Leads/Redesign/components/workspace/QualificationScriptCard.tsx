import { Spin, message } from "antd";
import { useCallback } from "react";
import type { Lead } from "@/Types/api/leads";
import { getRegistrationService } from "@/Services/RegistrationService";
import useTranslation from "@/Hooks/useTranslation";
import EmptyState from "@/Pages/Leads/Components/Qualification/EmptyState";
import InProgressView from "@/Pages/Leads/Components/Qualification/InProgressView";
import CompletedRecap from "@/Pages/Leads/Components/Qualification/CompletedRecap";
import type { LeadQualification } from "@/Types/qualification";
import type useLeadQualificationWorkspace from "../../hooks/useLeadQualificationWorkspace";
import LeadIcon from "../primitives/LeadIcon";

type QualificationWorkspace = ReturnType<typeof useLeadQualificationWorkspace>;

interface QualificationScriptCardProps {
    lead: Lead;
    workspace: QualificationWorkspace;
    workspaceRef?: React.RefObject<HTMLDivElement | null>;
    onOutcomeComplete?: () => void;
}

export default function QualificationScriptCard({
    lead,
    workspace,
    workspaceRef,
    onOutcomeComplete,
}: QualificationScriptCardProps) {
    const { t } = useTranslation();
    const registrationService = getRegistrationService();
    const {
        phase,
        current,
        history,
        templateTree,
        qualificationService,
        templateService,
        loadQualifications,
        setCurrent,
        setHistory,
        setTemplateTree,
        setPhase,
    } = workspace;

    const handleStarted = useCallback(
        async (qualification: LeadQualification) => {
            setCurrent(qualification);
            try {
                const treeResponse = await templateService.getTemplateTree(
                    qualification.template_id,
                    qualification.template_name,
                );
                setTemplateTree(treeResponse.data);
                setPhase("inProgress");
            } catch {
                message.error("Failed to load template");
            }
        },
        [setCurrent, setPhase, setTemplateTree, templateService],
    );

    const handleQualificationUpdated = useCallback(
        (qualification: LeadQualification) => {
            setCurrent(qualification);
            setHistory((prev) => {
                const without = prev.filter((h) => h.id !== qualification.id);
                return [qualification, ...without];
            });
            setPhase("completed");
            onOutcomeComplete?.();
        },
        [onOutcomeComplete, setCurrent, setHistory, setPhase],
    );

    const handleStartNew = useCallback(() => {
        setCurrent(null);
        setTemplateTree(null);
        setPhase("empty");
    }, [setCurrent, setPhase, setTemplateTree]);

    return (
        <div ref={workspaceRef} className="section-card">
            <header className="flex items-center justify-between border-b border-[#eef1f5] px-4 py-3">
                <div className="flex items-center gap-2">
                    <LeadIcon name="target" size={15} color="#1a6bb5" />
                    <h3 className="text-sm font-semibold text-[#1a1f2e]">
                        {t("pages.leads.tabs.qualification")}
                    </h3>
                </div>
            </header>
            <div className="p-4">
                {phase === "loading" && (
                    <div className="flex justify-center py-12">
                        <Spin size="large" />
                    </div>
                )}
                {phase === "empty" && (
                    <EmptyState
                        leadId={lead.id}
                        templateService={templateService}
                        qualificationService={qualificationService}
                        onStarted={handleStarted}
                    />
                )}
                {phase === "inProgress" && current && templateTree && (
                    <InProgressView
                        lead={lead}
                        qualification={current}
                        templateTree={templateTree}
                        qualificationService={qualificationService}
                        registrationService={registrationService}
                        onQualificationUpdated={handleQualificationUpdated}
                        onAbandoned={loadQualifications}
                    />
                )}
                {phase === "completed" && current && (
                    <CompletedRecap
                        qualification={current}
                        history={history}
                        templateService={templateService}
                        onStartNew={handleStartNew}
                    />
                )}
            </div>
        </div>
    );
}
