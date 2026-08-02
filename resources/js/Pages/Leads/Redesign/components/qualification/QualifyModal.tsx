import { useMemo, useState } from "react";
import type { Lead } from "@/Types/api/leads";
import type {
    LeadQualification,
    TemplateTree,
} from "@/Types/qualification";
import { Modal } from "@/Components/Redesign";
import { getRegistrationService } from "@/Services/RegistrationService";
import { useLeadQualificationService } from "@/Services/LeadQualificationService";
import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import BranchChangeWarningModal from "@/Pages/Leads/Components/Qualification/BranchChangeWarningModal";
import { useTd } from "@/Hooks/useDynamicTranslation";
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
}

export default function QualifyModal({
    open,
    lead,
    qualification,
    templateTree,
    onClose,
    onCompleted,
}: QualifyModalProps) {
    const { td } = useTd();
    const qualificationService = useLeadQualificationService();
    const registrationService = useMemo(() => getRegistrationService(), []);
    const [agentLanguage, setAgentLanguage] = useState(
        qualification.agent_language || "en",
    );

    const flow = useQualificationFlow({
        lead,
        qualification,
        templateTree,
        service: qualificationService,
        registrationService,
        agentLanguage,
        onQualificationUpdated: onCompleted,
    });

    const segment = flow.currentSegment;
    const showNav = segment?.type !== "outcome";

    const progress = useMemo(() => {
        const total = Math.max(flow.visibleSegments.length, 1);
        const current = Math.max(flow.currentIndex, 0) + 1;
        return {
            percent: Math.min(100, Math.round((current / total) * 100)),
            current,
            total,
        };
    }, [flow.currentIndex, flow.visibleSegments.length]);

    if (!open) return null;

    return (
        <>
            <Modal
                open={open}
                title={td("Qualification script")}
                onClose={onClose}
                footer={
                    <QualifyFooter flow={flow} hidden={!showNav} />
                }
            >
                <div style={{ display: "grid", gap: 16 }}>
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                        }}
                    >
                        <select
                            className="v2-input"
                            value={agentLanguage}
                            onChange={(e) => setAgentLanguage(e.target.value)}
                            style={{ width: "auto", minWidth: 140 }}
                            aria-label={td("Script language")}
                        >
                            {LANGUAGE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {td("Step")} {progress.current} {td("of")}{" "}
                            {progress.total}
                        </span>
                    </div>

                    <div
                        style={{
                            height: 4,
                            background: "#eef0f3",
                            borderRadius: 4,
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                width: `${progress.percent}%`,
                                height: "100%",
                                background: "#1a6bb5",
                                transition: "width 0.2s ease",
                            }}
                        />
                    </div>

                    {segment ? (
                        <QualifySegmentBody
                            flow={flow}
                            currentSegment={segment}
                            registrationService={registrationService}
                            agentLanguage={agentLanguage}
                        />
                    ) : (
                        <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                            {td("No steps available for this template.")}
                        </p>
                    )}
                </div>
            </Modal>

            <BranchChangeWarningModal
                open={Boolean(flow.branchChangePending)}
                onConfirm={() => void flow.confirmBranchChange()}
                onCancel={flow.cancelBranchChange}
                loading={flow.saving}
            />
        </>
    );
}
