import { useCallback, useMemo, useState } from "react";
import { Spin } from "antd";
import type { Lead } from "@/Types/api/leads";
import { getRegistrationService } from "@/Services/RegistrationService";
import DealBadge from "@/Pages/Deals/Redesign/components/primitives/DealBadge";
import type useLeadQualificationWorkspace from "../../hooks/useLeadQualificationWorkspace";
import { LEAD_REDESIGN_TOKENS as T } from "../../types";
import { useTd } from "@/Hooks/useDynamicTranslation";
import LeadPanelHeader from "./qualification/LeadPanelHeader";
import QualificationScriptIdle from "./qualification/QualificationScriptIdle";
import QualificationScriptCompleted from "./qualification/QualificationScriptCompleted";
import QualificationScriptFlow from "./qualification/QualificationScriptFlow";

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
    const { td } = useTd();
    const registrationService = useMemo(() => getRegistrationService(), []);
    const [collapsed, setCollapsed] = useState(false);

    const {
        phase,
        current,
        templateTree,
        qualificationService,
        loadQualifications,
        handleQualificationUpdated,
        handleStartNew,
        flowActive,
        outcome,
        isStartingFlow,
        templates,
        templatesLoading,
        selectedTemplateId,
        setSelectedTemplateId,
        startQualificationScript,
    } = workspace;

    const stepBadge = useMemo(() => {
        if (!flowActive || !current || !templateTree) return null;
        const segments = templateTree.segments ?? [];
        if (segments.length === 0) return null;
        const index = Math.max(
            0,
            segments.findIndex((s) => s.key === current.current_segment_key),
        );
        return `Step ${index + 1}/${segments.length}`;
    }, [current, flowActive, templateTree]);

    const handleQualificationUpdatedWithCallback = useCallback(
        (qualification: Parameters<typeof handleQualificationUpdated>[0]) => {
            handleQualificationUpdated(qualification);
            onOutcomeComplete?.();
        },
        [handleQualificationUpdated, onOutcomeComplete],
    );

    const handleBegin = useCallback(async () => {
        setCollapsed(false);
        await startQualificationScript(selectedTemplateId);
    }, [selectedTemplateId, startQualificationScript]);

    const handleTemplateChange = useCallback(
        (templateId: string) => {
            setSelectedTemplateId(templateId);
            if (flowActive || outcome) {
                handleStartNew();
            }
        },
        [flowActive, handleStartNew, outcome, setSelectedTemplateId],
    );

    const handleRunAgain = useCallback(async () => {
        handleStartNew();
        setCollapsed(false);
        await startQualificationScript(selectedTemplateId);
    }, [handleStartNew, selectedTemplateId, startQualificationScript]);

    const showCollapse = flowActive || Boolean(outcome);

    return (
        <div ref={workspaceRef} className="section-card">
            <LeadPanelHeader
                title={td("Qualification script")}
                rightSlot={
                    <>
                        {stepBadge && (
                            <DealBadge variant="blue">{stepBadge}</DealBadge>
                        )}
                        <select
                            value={selectedTemplateId ?? ""}
                            onChange={(e) =>
                                handleTemplateChange(e.target.value)
                            }
                            disabled={
                                templatesLoading || templates.length === 0
                            }
                            style={{
                                border: "none",
                                borderRadius: 6,
                                padding: "5px 8px",
                                fontSize: 12,
                                outline: "none",
                                background: "rgba(255,255,255,0.12)",
                                color: T.WHITE,
                                maxWidth: 220,
                            }}
                        >
                            {templates.length === 0 ? (
                                <option value="">{td("No templates")}</option>
                            ) : (
                                templates.map((template) => (
                                    <option
                                        key={template.id}
                                        value={template.id}
                                        style={{ color: T.TEXT }}
                                    >
                                        {template.name}
                                    </option>
                                ))
                            )}
                        </select>
                        {showCollapse && (
                            <button
                                type="button"
                                onClick={() => setCollapsed((value) => !value)}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "rgba(255,255,255,0.85)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                {collapsed ? td("Expand") : td("Collapse")}
                            </button>
                        )}
                    </>
                }
            />

            {!collapsed && (
                <div className="section-body" style={{ padding: "12px 14px" }}>
                    {phase === "loading" && (
                        <div className="flex justify-center py-10">
                            <Spin />
                        </div>
                    )}

                    {phase === "empty" && (
                        <QualificationScriptIdle
                            templates={templates}
                            selectedTemplateId={selectedTemplateId}
                            onBegin={() => void handleBegin()}
                            isStarting={isStartingFlow}
                            templatesLoading={templatesLoading}
                        />
                    )}

                    {phase === "inProgress" && current && templateTree && (
                        <QualificationScriptFlow
                            lead={lead}
                            qualification={current}
                            templateTree={templateTree}
                            qualificationService={qualificationService}
                            registrationService={registrationService}
                            onQualificationUpdated={
                                handleQualificationUpdatedWithCallback
                            }
                            onAbandoned={loadQualifications}
                        />
                    )}

                    {phase === "completed" && current && (
                        <QualificationScriptCompleted
                            qualification={current}
                            onRunAgain={() => void handleRunAgain()}
                            isStarting={isStartingFlow}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
