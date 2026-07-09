import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
import type { LeadQualification, TemplateTree } from "@/Types/qualification";
import { useLeadQualificationService } from "@/Services/LeadQualificationService";
import { getQualificationTemplateService } from "@/Services/QualificationTemplateService";

export type QualificationLoaderPhase =
    | "loading"
    | "empty"
    | "inProgress"
    | "completed"
    | "disabled";

interface UseLeadQualificationLoaderOptions {
    enabled?: boolean;
}

export default function useLeadQualificationLoader(
    leadId: number,
    { enabled = true }: UseLeadQualificationLoaderOptions = {},
) {
    const qualificationService = useLeadQualificationService();
    const templateService = useMemo(
        () => getQualificationTemplateService(),
        [],
    );

    const qualificationServiceRef = useRef(qualificationService);
    const templateServiceRef = useRef(templateService);
    qualificationServiceRef.current = qualificationService;
    templateServiceRef.current = templateService;

    const loadRequestIdRef = useRef(0);

    const [phase, setPhase] = useState<QualificationLoaderPhase>(
        enabled ? "loading" : "disabled",
    );
    const [current, setCurrent] = useState<LeadQualification | null>(null);
    const [history, setHistory] = useState<LeadQualification[]>([]);
    const [templateTree, setTemplateTree] = useState<TemplateTree | null>(null);

    const loadQualifications = useCallback(async () => {
        if (!enabled) {
            loadRequestIdRef.current += 1;
            setPhase("disabled");
            setCurrent(null);
            setHistory([]);
            setTemplateTree(null);
            return;
        }

        const requestId = ++loadRequestIdRef.current;
        setPhase("loading");

        try {
            const response =
                await qualificationServiceRef.current.getQualifications(leadId);

            if (requestId !== loadRequestIdRef.current) {
                return;
            }

            setCurrent(response.current);
            setHistory(response.history ?? []);

            if (response.current?.status === "inProgress") {
                const treeResponse =
                    await templateServiceRef.current.getTemplateTree(
                        response.current.template_id,
                        response.current.template_name,
                    );

                if (requestId !== loadRequestIdRef.current) {
                    return;
                }

                setTemplateTree(treeResponse.data);
                setPhase("inProgress");
                return;
            }

            if (response.current?.status === "completed") {
                setTemplateTree(null);
                setPhase("completed");
                return;
            }

            setTemplateTree(null);
            setPhase("empty");
        } catch {
            if (requestId !== loadRequestIdRef.current) {
                return;
            }

            message.error("Failed to load qualifications");
            setTemplateTree(null);
            setPhase("empty");
        }
    }, [enabled, leadId]);

    useEffect(() => {
        void loadQualifications();
    }, [loadQualifications]);

    const handleStarted = useCallback(async (qualification: LeadQualification) => {
        const requestId = ++loadRequestIdRef.current;
        setCurrent(qualification);

        try {
            const treeResponse =
                await templateServiceRef.current.getTemplateTree(
                    qualification.template_id,
                    qualification.template_name,
                );

            if (requestId !== loadRequestIdRef.current) {
                return;
            }

            setTemplateTree(treeResponse.data);
            setPhase("inProgress");
        } catch {
            if (requestId !== loadRequestIdRef.current) {
                return;
            }

            message.error("Failed to load template");
            setPhase("empty");
        }
    }, []);

    const handleQualificationUpdated = useCallback(
        (qualification: LeadQualification) => {
            setCurrent(qualification);
            setHistory((prev) => {
                const without = prev.filter((item) => item.id !== qualification.id);
                return [qualification, ...without];
            });
            setTemplateTree(null);
            setPhase("completed");
        },
        [],
    );

    const handleStartNew = useCallback(() => {
        loadRequestIdRef.current += 1;
        setCurrent(null);
        setTemplateTree(null);
        setPhase("empty");
    }, []);

    return {
        enabled,
        phase,
        current,
        history,
        templateTree,
        qualificationService,
        templateService,
        loadQualifications,
        handleStarted,
        handleQualificationUpdated,
        handleStartNew,
        setCurrent,
        setHistory,
        setTemplateTree,
        setPhase,
    };
}
