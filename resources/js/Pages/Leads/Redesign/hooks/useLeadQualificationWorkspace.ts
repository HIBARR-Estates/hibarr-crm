import { useCallback, useEffect, useMemo, useState } from "react";
import { message } from "antd";
import type { Lead } from "@/Types/api/leads";
import type { LeadQualification, TemplateTree } from "@/Types/qualification";
import { useLeadQualificationService } from "@/Services/LeadQualificationService";
import { getQualificationTemplateService } from "@/Services/QualificationTemplateService";

export type QualificationWorkspacePhase =
    | "loading"
    | "empty"
    | "inProgress"
    | "completed";

export default function useLeadQualificationWorkspace(lead: Lead) {
    const qualificationService = useLeadQualificationService();
    const templateService = useMemo(
        () => getQualificationTemplateService(),
        [],
    );

    const [phase, setPhase] = useState<QualificationWorkspacePhase>("loading");
    const [current, setCurrent] = useState<LeadQualification | null>(null);
    const [history, setHistory] = useState<LeadQualification[]>([]);
    const [templateTree, setTemplateTree] = useState<TemplateTree | null>(null);

    const loadQualifications = useCallback(async () => {
        setPhase("loading");
        try {
            const response = await qualificationService.getQualifications(lead.id);
            setCurrent(response.current);
            setHistory(response.history ?? []);

            if (response.current?.status === "inProgress") {
                const treeResponse = await templateService.getTemplateTree(
                    response.current.template_id,
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

    const flowActive = phase === "inProgress";
    const outcome =
        current?.status === "completed" ? current.outcome ?? null : null;

    return {
        phase,
        current,
        history,
        templateTree,
        flowActive,
        outcome,
        qualificationService,
        templateService,
        loadQualifications,
        setCurrent,
        setHistory,
        setTemplateTree,
        setPhase,
    };
}
