import { useCallback, useEffect, useState } from "react";
import { message } from "antd";
import type { Lead } from "@/Types/api/leads";
import type {
    LeadQualification,
    PublishedTemplate,
} from "@/Types/qualification";
import useLeadQualificationLoader from "@/Pages/Leads/Components/Qualification/useLeadQualificationLoader";

interface QualificationWorkspaceSeed {
    current: LeadQualification | null;
    history: LeadQualification[];
}

interface UseLeadQualificationWorkspaceOptions {
    enabled?: boolean;
    seed?: QualificationWorkspaceSeed | null;
}

export default function useLeadQualificationWorkspace(
    lead: Lead,
    { enabled = true, seed = null }: UseLeadQualificationWorkspaceOptions = {},
) {
    const loader = useLeadQualificationLoader(lead.id, { enabled, seed });
    const [isStartingFlow, setIsStartingFlow] = useState(false);
    const [templates, setTemplates] = useState<PublishedTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
        null,
    );

    const flowActive = loader.enabled && loader.phase === "inProgress";
    const outcome =
        loader.enabled && loader.current?.status === "completed"
            ? loader.current.outcome ?? null
            : null;

    useEffect(() => {
        if (!enabled) {
            setTemplates([]);
            setSelectedTemplateId(null);
            return;
        }

        let cancelled = false;
        const load = async () => {
            setTemplatesLoading(true);
            try {
                const response =
                    await loader.templateService.getPublishedTemplates();
                if (cancelled) return;
                const list = response.data ?? [];
                setTemplates(list);
                setSelectedTemplateId((current) => {
                    if (current && list.some((item) => item.id === current)) {
                        return current;
                    }
                    return list[0]?.id ?? null;
                });
            } catch {
                if (!cancelled) {
                    setTemplates([]);
                    setSelectedTemplateId(null);
                }
            } finally {
                if (!cancelled) setTemplatesLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [enabled, loader.templateService]);

    const startQualificationScript = useCallback(
        async (templateId?: string | null): Promise<boolean> => {
            if (!enabled || isStartingFlow) return flowActive;
            if (flowActive) return true;

            const targetId = templateId ?? selectedTemplateId;
            const template =
                templates.find((item) => item.id === targetId) ?? templates[0];

            if (!template) {
                message.warning(
                    "No published qualification templates available",
                );
                return false;
            }

            setIsStartingFlow(true);
            try {
                const qualification =
                    await loader.qualificationService.startQualification(
                        lead.id,
                        {
                            template_id: template.id,
                            template_version: template.version,
                            template_name: template.name,
                            agent_language: "en",
                        },
                    );

                setSelectedTemplateId(template.id);
                await loader.handleStarted(qualification);
                return true;
            } catch {
                message.error("Failed to start qualification script");
                return false;
            } finally {
                setIsStartingFlow(false);
            }
        },
        [
            enabled,
            flowActive,
            isStartingFlow,
            lead.id,
            loader.handleStarted,
            loader.qualificationService,
            selectedTemplateId,
            templates,
        ],
    );

    return {
        ...loader,
        flowActive,
        outcome,
        isStartingFlow,
        templates,
        templatesLoading,
        selectedTemplateId,
        setSelectedTemplateId,
        startQualificationScript,
    };
}
