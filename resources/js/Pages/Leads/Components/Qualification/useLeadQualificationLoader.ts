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

interface QualificationWorkspaceSeed {
    current: LeadQualification | null;
    history: LeadQualification[];
}

interface UseLeadQualificationLoaderOptions {
    enabled?: boolean;
    /**
     * Server-rendered `{current, history}` from the page props. When present the
     * initial `lead-qualifications.index` request is skipped — the template tree
     * fetch stays, since it lives on the external template API.
     */
    seed?: QualificationWorkspaceSeed | null;
}

export default function useLeadQualificationLoader(
    leadId: number,
    { enabled = true, seed = null }: UseLeadQualificationLoaderOptions = {},
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
    // The seed is a mount-time value only; holding it in a ref keeps a fresh
    // prop identity each render from re-triggering the bootstrap effect.
    const seedRef = useRef(seed);
    const seedConsumedRef = useRef(false);

    const [phase, setPhase] = useState<QualificationLoaderPhase>(() => {
        if (!enabled) return "disabled";
        if (!seed) return "loading";
        // An in-progress run still needs its template tree before it can render.
        if (seed.current?.status === "inProgress") return "loading";
        if (seed.current?.status === "completed") return "completed";
        return "empty";
    });
    const [current, setCurrent] = useState<LeadQualification | null>(() =>
        enabled ? seed?.current ?? null : null,
    );
    const [history, setHistory] = useState<LeadQualification[]>(() =>
        enabled ? seed?.history ?? [] : [],
    );
    const [templateTree, setTemplateTree] = useState<TemplateTree | null>(null);

    const applyWorkspace = useCallback(
        async (workspace: QualificationWorkspaceSeed, requestId: number) => {
            setCurrent(workspace.current);
            setHistory(workspace.history ?? []);

            if (workspace.current?.status === "inProgress") {
                const treeResponse =
                    await templateServiceRef.current.getTemplateTree(
                        workspace.current.template_id,
                        workspace.current.template_name,
                    );

                if (requestId !== loadRequestIdRef.current) {
                    return;
                }

                setTemplateTree(treeResponse.data);
                setPhase("inProgress");
                return;
            }

            if (workspace.current?.status === "completed") {
                setTemplateTree(null);
                setPhase("completed");
                return;
            }

            setTemplateTree(null);
            setPhase("empty");
        },
        [],
    );

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

            await applyWorkspace(response, requestId);
        } catch {
            if (requestId !== loadRequestIdRef.current) {
                return;
            }

            message.error("Failed to load qualifications");
            setTemplateTree(null);
            setPhase("empty");
        }
    }, [applyWorkspace, enabled, leadId]);

    useEffect(() => {
        const initialSeed = seedRef.current;

        // Bootstrap from the server-rendered workspace when we have one, so the
        // first paint costs no `lead-qualifications.index` round-trip.
        if (enabled && initialSeed && !seedConsumedRef.current) {
            seedConsumedRef.current = true;
            const requestId = ++loadRequestIdRef.current;

            void applyWorkspace(initialSeed, requestId).catch(() => {
                if (requestId !== loadRequestIdRef.current) return;
                message.error("Failed to load qualifications");
                setTemplateTree(null);
                setPhase("empty");
            });
            return;
        }

        seedConsumedRef.current = true;
        void loadQualifications();
    }, [applyWorkspace, enabled, loadQualifications]);

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
