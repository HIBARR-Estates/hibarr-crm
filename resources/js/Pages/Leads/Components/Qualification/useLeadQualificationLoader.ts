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

/**
 * Loads the lead's qualification workspace + OL template tree.
 *
 * Important UX invariants:
 * - Bootstrap runs once per (enabled, leadId); it does not re-hit the index API
 *   on incidental callback identity changes.
 * - `templateTree` is retained across refetches for the same template so the
 *   qualify modal never unmounts from a brief null tree.
 * - Closing/finishing does not require wiping the tree before `qualificationOpen`
 *   flips false — callers should close first, then finish.
 */
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

    const treeRequestIdRef = useRef(0);
    const bootstrappedLeadIdRef = useRef<number | null>(null);
    const treeCacheRef = useRef<Map<string, TemplateTree>>(new Map());
    const currentRef = useRef<LeadQualification | null>(null);
    const seedRef = useRef(seed);
    seedRef.current = seed;

    const [phase, setPhase] = useState<QualificationLoaderPhase>(() => {
        if (!enabled) return "disabled";
        if (!seed) return "loading";
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
    const [templateTree, setTemplateTree] = useState<TemplateTree | null>(
        () => {
            const templateId = seed?.current?.template_id;
            return templateId
                ? treeCacheRef.current.get(templateId) ?? null
                : null;
        },
    );
    const [treeLoading, setTreeLoading] = useState(
        () =>
            Boolean(
                enabled &&
                    seed?.current?.status === "inProgress" &&
                    !treeCacheRef.current.get(seed.current.template_id),
            ),
    );

    currentRef.current = current;

    const rememberTree = useCallback(
        (templateId: string, tree: TemplateTree) => {
            treeCacheRef.current.set(templateId, tree);
            setTemplateTree(tree);
            setTreeLoading(false);
        },
        [],
    );

    const loadTreeForQualification = useCallback(
        async (qualification: LeadQualification): Promise<boolean> => {
            const cached = treeCacheRef.current.get(qualification.template_id);
            if (cached) {
                setTemplateTree(cached);
                setTreeLoading(false);
                return true;
            }

            const requestId = ++treeRequestIdRef.current;
            setTreeLoading(true);

            try {
                const treeResponse =
                    await templateServiceRef.current.getTemplateTree(
                        qualification.template_id,
                        qualification.template_name,
                    );

                if (requestId !== treeRequestIdRef.current) {
                    return false;
                }

                rememberTree(qualification.template_id, treeResponse.data);
                return true;
            } catch {
                if (requestId !== treeRequestIdRef.current) {
                    return false;
                }

                setTreeLoading(false);
                message.error("Failed to load template");
                return false;
            }
        },
        [rememberTree],
    );

    const applyWorkspace = useCallback(
        async (
            workspace: QualificationWorkspaceSeed,
            options: { fetchTree?: boolean } = {},
        ) => {
            const { fetchTree = true } = options;
            setCurrent(workspace.current);
            setHistory(workspace.history ?? []);

            if (workspace.current?.status === "inProgress") {
                setPhase("inProgress");
                if (fetchTree) {
                    await loadTreeForQualification(workspace.current);
                }
                return;
            }

            if (workspace.current?.status === "completed") {
                // Keep any cached tree so reopening a just-finished run does not
                // flash empty; do not clear to null while a modal may still be open.
                const cached = workspace.current.template_id
                    ? treeCacheRef.current.get(workspace.current.template_id)
                    : null;
                if (cached) {
                    setTemplateTree(cached);
                }
                setTreeLoading(false);
                setPhase("completed");
                return;
            }

            setTreeLoading(false);
            setPhase("empty");
        },
        [loadTreeForQualification],
    );

    const loadQualifications = useCallback(async () => {
        if (!enabled) {
            treeRequestIdRef.current += 1;
            setPhase("disabled");
            setCurrent(null);
            setHistory([]);
            setTemplateTree(null);
            setTreeLoading(false);
            return;
        }

        setPhase((prev) => (prev === "inProgress" ? prev : "loading"));

        try {
            const response =
                await qualificationServiceRef.current.getQualifications(leadId);
            await applyWorkspace(response);
        } catch {
            message.error("Failed to load qualifications");
            setTreeLoading(false);
            setPhase("empty");
        }
    }, [applyWorkspace, enabled, leadId]);

    // One-shot bootstrap per lead while enabled. Do not re-run when callback
    // identities churn — that was re-fetching the tree and unmounting the modal.
    useEffect(() => {
        if (!enabled) {
            bootstrappedLeadIdRef.current = null;
            treeRequestIdRef.current += 1;
            setPhase("disabled");
            setCurrent(null);
            setHistory([]);
            setTemplateTree(null);
            setTreeLoading(false);
            return;
        }

        if (bootstrappedLeadIdRef.current === leadId) {
            return;
        }
        bootstrappedLeadIdRef.current = leadId;

        const initialSeed = seedRef.current;
        if (initialSeed) {
            void applyWorkspace(initialSeed).catch(() => {
                message.error("Failed to load qualifications");
                setTreeLoading(false);
                setPhase("empty");
            });
            return;
        }

        void loadQualifications();
        // intentionally omit applyWorkspace/loadQualifications from deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, leadId]);

    const handleStarted = useCallback(
        async (qualification: LeadQualification) => {
            setCurrent(qualification);
            setPhase("inProgress");
            const ok = await loadTreeForQualification(qualification);
            if (!ok && !treeCacheRef.current.get(qualification.template_id)) {
                setPhase("empty");
            }
        },
        [loadTreeForQualification],
    );

    const handleQualificationUpdated = useCallback(
        (qualification: LeadQualification) => {
            setCurrent(qualification);
            setHistory((prev) => {
                const without = prev.filter(
                    (item) => item.id !== qualification.id,
                );
                return [qualification, ...without];
            });

            if (qualification.status === "completed") {
                setPhase("completed");
            }
        },
        [],
    );

    /**
     * Dismiss the script session after the modal has closed. Keeps the tree
     * cached so a rapid reopen does not remount through a null-tree gap.
     */
    const finishQualificationSession = useCallback(
        (qualification?: LeadQualification | null) => {
            if (qualification) {
                setCurrent(qualification);
                setHistory((prev) => {
                    const without = prev.filter(
                        (item) => item.id !== qualification.id,
                    );
                    return [qualification, ...without];
                });
            }
            setTreeLoading(false);
            setPhase("completed");
        },
        [],
    );

    const resumeQualification = useCallback(
        async (qualification: LeadQualification): Promise<boolean> => {
            if (qualification.status !== "inProgress") {
                return false;
            }

            const previous = currentRef.current;

            setHistory((historyPrev) => {
                const without = historyPrev.filter(
                    (item) => item.id !== qualification.id,
                );
                if (
                    previous &&
                    previous.id !== qualification.id &&
                    !without.some((item) => item.id === previous.id)
                ) {
                    return [previous, ...without];
                }
                return without;
            });
            setCurrent(qualification);
            setPhase("inProgress");

            return loadTreeForQualification(qualification);
        },
        [loadTreeForQualification],
    );

    const deleteQualification = useCallback(
        async (qualificationId: number): Promise<boolean> => {
            try {
                const workspace =
                    await qualificationServiceRef.current.deleteQualification(
                        qualificationId,
                    );

                // Drop cache entry for the deleted run's template only if no
                // remaining run shares it — simplest: leave cache, harmless.
                await applyWorkspace(workspace);
                return true;
            } catch {
                message.error("Failed to delete qualification");
                return false;
            }
        },
        [applyWorkspace],
    );

    const handleStartNew = useCallback(() => {
        treeRequestIdRef.current += 1;
        setCurrent(null);
        setTreeLoading(false);
        setPhase("empty");
    }, []);

    return {
        enabled,
        phase,
        current,
        history,
        templateTree,
        treeLoading,
        qualificationService,
        templateService,
        loadQualifications,
        handleStarted,
        handleQualificationUpdated,
        finishQualificationSession,
        resumeQualification,
        deleteQualification,
        handleStartNew,
        setCurrent,
        setHistory,
        setTemplateTree,
        setPhase,
    };
}
