import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Spin, message } from "antd";
import { Lead } from "@/Types/api/leads";
import {
    LeadQualification,
    TemplateTree,
} from "@/Types/qualification";
import { useLeadQualificationService } from "@/Services/LeadQualificationService";
import { getQualificationTemplateService } from "@/Services/QualificationTemplateService";
import { getRegistrationService } from "@/Services/RegistrationService";
import EmptyState from "./EmptyState";
import InProgressView from "./InProgressView";
import CompletedRecap from "./CompletedRecap";

interface LeadQualificationTabProps {
    lead: Lead;
}

type TabPhase = "loading" | "empty" | "inProgress" | "completed";

const LeadQualificationTab: React.FC<LeadQualificationTabProps> = ({
    lead,
}) => {
    const qualificationService = useLeadQualificationService();
    const templateService = useMemo(
        () => getQualificationTemplateService(),
        [],
    );
    const registrationService = useMemo(() => getRegistrationService(), []);

    const [phase, setPhase] = useState<TabPhase>("loading");
    const [current, setCurrent] = useState<LeadQualification | null>(null);
    const [history, setHistory] = useState<LeadQualification[]>([]);
    const [templateTree, setTemplateTree] = useState<TemplateTree | null>(
        null,
    );

    const loadQualifications = useCallback(async () => {
        setPhase("loading");
        try {
            const response = await qualificationService.getQualifications(
                lead.id,
            );
            setCurrent(response.current);
            setHistory(response.history ?? []);

            if (response.current?.status === "inProgress") {
                const treeResponse = await templateService.getTemplateTree(
                    response.current.template_id,
                    response.current.template_name,
                );
                setTemplateTree(treeResponse.data);
                setPhase("inProgress");
            } else if (response.current?.status === "completed") {
                setPhase("completed");
            } else {
                setPhase("empty");
            }
        } catch {
            message.error("Failed to load qualifications");
            setPhase("empty");
        }
    }, [lead.id, qualificationService, templateService]);

    useEffect(() => {
        loadQualifications();
    }, [loadQualifications]);

    const handleStarted = async (qualification: LeadQualification) => {
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
    };

    const handleQualificationUpdated = (qualification: LeadQualification) => {
        setCurrent(qualification);
        setHistory((prev) => {
            const without = prev.filter((h) => h.id !== qualification.id);
            return [qualification, ...without];
        });
        setPhase("completed");
    };

    const handleStartNew = () => {
        setCurrent(null);
        setTemplateTree(null);
        setPhase("empty");
    };

    const handleAbandoned = () => {
        loadQualifications();
    };

    if (phase === "loading") {
        return (
            <div className="flex justify-center py-16">
                <Spin size="large" />
            </div>
        );
    }

    if (phase === "empty") {
        return (
            <EmptyState
                leadId={lead.id}
                templateService={templateService}
                qualificationService={qualificationService}
                onStarted={handleStarted}
            />
        );
    }

    if (phase === "inProgress" && current && templateTree) {
        return (
            <InProgressView
                lead={lead}
                qualification={current}
                templateTree={templateTree}
                qualificationService={qualificationService}
                registrationService={registrationService}
                onQualificationUpdated={handleQualificationUpdated}
                onAbandoned={handleAbandoned}
            />
        );
    }

    if (phase === "completed" && current) {
        return (
            <CompletedRecap
                qualification={current}
                history={history}
                templateService={templateService}
                onStartNew={handleStartNew}
            />
        );
    }

    return (
        <EmptyState
            leadId={lead.id}
            templateService={templateService}
            qualificationService={qualificationService}
            onStarted={handleStarted}
        />
    );
};

export default LeadQualificationTab;
