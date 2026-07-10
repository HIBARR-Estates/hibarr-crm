import { useCallback, useState } from "react";
import { message } from "antd";
import type { Lead } from "@/Types/api/leads";
import useLeadQualificationLoader from "@/Pages/Leads/Components/Qualification/useLeadQualificationLoader";

interface UseLeadQualificationWorkspaceOptions {
    enabled?: boolean;
}

export default function useLeadQualificationWorkspace(
    lead: Lead,
    { enabled = true }: UseLeadQualificationWorkspaceOptions = {},
) {
    const loader = useLeadQualificationLoader(lead.id, { enabled });
    const [isStartingFlow, setIsStartingFlow] = useState(false);

    const flowActive = loader.enabled && loader.phase === "inProgress";
    const outcome =
        loader.enabled && loader.current?.status === "completed"
            ? loader.current.outcome ?? null
            : null;

    const startQualificationScript = useCallback(async (): Promise<boolean> => {
        if (!enabled || isStartingFlow) return flowActive;
        if (flowActive) return true;

        setIsStartingFlow(true);
        try {
            const response =
                await loader.templateService.getPublishedTemplates();
            const templates = response.data ?? [];
            if (templates.length === 0) {
                message.warning(
                    "No published qualification templates available",
                );
                return false;
            }

            const template = templates[0];
            const qualification =
                await loader.qualificationService.startQualification(lead.id, {
                    template_id: template.id,
                    template_version: template.version,
                    template_name: template.name,
                    agent_language: "en",
                });

            await loader.handleStarted(qualification);
            return true;
        } catch {
            message.error("Failed to start qualification script");
            return false;
        } finally {
            setIsStartingFlow(false);
        }
    }, [
        enabled,
        flowActive,
        isStartingFlow,
        lead.id,
        loader.handleStarted,
        loader.qualificationService,
        loader.templateService,
    ]);

    return {
        ...loader,
        flowActive,
        outcome,
        isStartingFlow,
        startQualificationScript,
    };
}
