import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import { Lead } from "@/Types/api/leads";
import {
    LeadQualification,
    QualificationLeadPatch,
    QualificationOutcome,
    Segment,
    SegmentAnswerState,
    TemplateTree,
} from "@/Types/qualification";
import { LeadQualificationService } from "@/Services/LeadQualificationService";
import { RegistrationService } from "@/Services/RegistrationService";
import type { PageProps } from "@/Components/DashboardLayout";
import {
    answersFromQualification,
    buildTokenMap,
    computeVisibleSegments,
    computeWalkSegments,
    findEntrySegment,
    getActionsForSelectedOutcomes,
    getBranchOptionKeys,
    mapOptionIdsToStoredValues,
    resolveTokens,
    validateSegmentAnswer,
} from "./qualificationUtils";

export interface UseQualificationFlowOptions {
    lead: Lead;
    qualification: LeadQualification;
    templateTree: TemplateTree;
    service: LeadQualificationService;
    /** Kept for callers that also run post-complete action registrations. */
    registrationService: RegistrationService;
    agentLanguage: string;
    onQualificationUpdated: (qualification: LeadQualification) => void;
    /** Fired when completing an outcome also changed the lead's lifecycle status server-side. */
    onLeadUpdated?: (lead: QualificationLeadPatch) => void;
}

/** @deprecated Soft-hide no longer prompts; kept for legacy callers. */
export interface BranchChangePending {
    segmentKey: string;
    newValues: string[];
    newText?: string | null;
}

export const useQualificationFlow = ({
    lead,
    qualification,
    templateTree,
    service,
    registrationService: _registrationService,
    agentLanguage,
    onQualificationUpdated,
    onLeadUpdated,
}: UseQualificationFlowOptions) => {
    const { props } = usePage<PageProps>();
    const tokenMap = useMemo(
        () => buildTokenMap(lead, props.auth),
        [lead, props.auth],
    );

    const [answers, setAnswers] = useState<Record<string, SegmentAnswerState>>(
        () => answersFromQualification(qualification.answers, templateTree),
    );
    const [currentSegmentKey, setCurrentSegmentKey] = useState<string>(() => {
        if (qualification.current_segment_key) {
            return qualification.current_segment_key;
        }
        const visible = computeVisibleSegments(
            templateTree,
            answersFromQualification(qualification.answers, templateTree),
        );
        return visible[0]?.key ?? "";
    });
    /** Completing still blocks the CTA; answer saves never block inputs. */
    const [completing, setCompleting] = useState(false);

    const pendingTimers = useRef(
        new Map<string, ReturnType<typeof setTimeout>>(),
    );
    /** Per-segment save chain — serializes upserts so out-of-order network
     * responses can't clobber a newer answer with a stale one. */
    const saveChains = useRef(new Map<string, Promise<unknown>>());
    const inFlight = useRef(new Set<Promise<unknown>>());
    const savingListeners = useRef(new Set<(saving: boolean) => void>());

    const notifySaving = useCallback(() => {
        const saving =
            pendingTimers.current.size > 0 || inFlight.current.size > 0;
        savingListeners.current.forEach((listener) => listener(saving));
    }, []);

    const subscribeSaving = useCallback((cb: (saving: boolean) => void) => {
        savingListeners.current.add(cb);
        cb(pendingTimers.current.size > 0 || inFlight.current.size > 0);
        return () => {
            savingListeners.current.delete(cb);
        };
    }, []);

    const trackInFlight = useCallback(
        (promise: Promise<unknown>) => {
            inFlight.current.add(promise);
            notifySaving();
            promise.catch(() => {}).then(() => {
                inFlight.current.delete(promise);
                notifySaving();
            });
            return promise;
        },
        [notifySaving],
    );

    const persistAnswer = useCallback(
        (segment: Segment, values: string[], text?: string | null) => {
            const storedValues = mapOptionIdsToStoredValues(segment, values);
            const previous =
                saveChains.current.get(segment.key) ?? Promise.resolve();
            const chained = previous
                .catch(() => {})
                .then(() =>
                    service
                        .upsertAnswer(qualification.id, {
                            segment_key: segment.key,
                            answer_values: storedValues,
                            answer_text: text ?? null,
                        })
                        .catch(() => {
                            message.error("Failed to save answer");
                        }),
                );
            saveChains.current.set(segment.key, chained);
            return trackInFlight(chained);
        },
        [qualification.id, service, trackInFlight],
    );

    /**
     * Optimistic local patch + background upsert. Never awaits in a way that
     * disables inputs — mirrors Deal Analysis field saves.
     */
    const applyAnswerChange = useCallback(
        (
            segment: Segment,
            values: string[],
            text?: string | null,
        ): void => {
            setAnswers((prev) => ({
                ...prev,
                [segment.key]: {
                    answer_values: values,
                    answer_text: text ?? null,
                },
            }));

            const existing = pendingTimers.current.get(segment.key);
            if (existing) clearTimeout(existing);

            // Debounce free-text / context; discrete picks flush immediately.
            const delay =
                segment.answerType === "text"
                    ? 400
                    : text != null &&
                        (segment.answerType === "singleSelect" ||
                            segment.answerType === "multiSelect" ||
                            segment.answerType === "boolean")
                      ? 400
                      : 0;

            const timer = setTimeout(() => {
                pendingTimers.current.delete(segment.key);
                notifySaving();
                void persistAnswer(segment, values, text);
            }, delay);

            pendingTimers.current.set(segment.key, timer);
            notifySaving();
        },
        [notifySaving, persistAnswer],
    );

    const answersRef = useRef(answers);
    answersRef.current = answers;

    const flushPendingSaves = useCallback((): Promise<void> => {
        const snapshot = answersRef.current;
        pendingTimers.current.forEach((timer, key) => {
            clearTimeout(timer);
            const answer = snapshot[key];
            const segment = templateTree.segments.find((s) => s.key === key);
            if (segment && answer) {
                void persistAnswer(
                    segment,
                    answer.answer_values,
                    answer.answer_text,
                );
            }
        });
        pendingTimers.current.clear();
        notifySaving();
        return Promise.all([...inFlight.current]).then(() => undefined);
    }, [notifySaving, persistAnswer, templateTree.segments]);

    useEffect(() => {
        return () => {
            pendingTimers.current.forEach((timer) => clearTimeout(timer));
            pendingTimers.current.clear();
        };
    }, []);

    const entrySegment = useMemo(
        () => findEntrySegment(templateTree),
        [templateTree],
    );

    /** All unlocked segments including outcomes (legacy tab navigation). */
    const visibleSegments = useMemo(
        () => computeVisibleSegments(templateTree, answers),
        [templateTree, answers],
    );

    /** Non-outcome segments for the redesign stepped walk. */
    const walkSegments = useMemo(
        () => computeWalkSegments(templateTree, answers),
        [templateTree, answers],
    );

    const currentIndex = useMemo(
        () => visibleSegments.findIndex((s) => s.key === currentSegmentKey),
        [visibleSegments, currentSegmentKey],
    );

    const currentSegment: Segment | undefined =
        currentIndex >= 0
            ? visibleSegments[currentIndex]
            : visibleSegments[0];

    useEffect(() => {
        if (
            currentSegmentKey &&
            !visibleSegments.some((s) => s.key === currentSegmentKey)
        ) {
            const fallback =
                visibleSegments[
                    Math.min(currentIndex, visibleSegments.length - 1)
                ] ?? visibleSegments[0];
            if (fallback) {
                setCurrentSegmentKey(fallback.key);
            }
        }
    }, [visibleSegments, currentSegmentKey, currentIndex]);

    const persistNavigation = useCallback(
        async (segmentKey: string) => {
            try {
                await service.updateNavigation(qualification.id, {
                    current_segment_key: segmentKey,
                });
            } catch {
                // Non-blocking — resume is best-effort
            }
        },
        [qualification.id, service],
    );

    const jumpToSegment = useCallback(
        async (segmentKey: string) => {
            const allowed =
                walkSegments.some((s) => s.key === segmentKey) ||
                visibleSegments.some(
                    (s) => s.key === segmentKey && s.type === "outcome",
                );
            if (!allowed) {
                return;
            }
            setCurrentSegmentKey(segmentKey);
            await persistNavigation(segmentKey);
        },
        [persistNavigation, visibleSegments, walkSegments],
    );

    const walkIndex = useMemo(
        () => walkSegments.findIndex((s) => s.key === currentSegmentKey),
        [walkSegments, currentSegmentKey],
    );

    const canGoBack = currentIndex > 0;
    const isLastSegment = currentIndex === visibleSegments.length - 1;
    const isLastWalkSegment =
        walkSegments.length > 0 &&
        (walkIndex === walkSegments.length - 1 ||
            (walkIndex < 0 &&
                Boolean(
                    currentSegment && currentSegment.type === "outcome",
                )));

    const validationError = currentSegment
        ? validateSegmentAnswer(currentSegment, answers[currentSegment.key])
        : null;

    const goBack = useCallback(async () => {
        if (!canGoBack) return;
        const prev = visibleSegments[currentIndex - 1];
        setCurrentSegmentKey(prev.key);
        await persistNavigation(prev.key);
    }, [canGoBack, currentIndex, persistNavigation, visibleSegments]);

    const goNext = useCallback(
        async (options?: { skipValidation?: boolean }) => {
            if (!currentSegment) return;
            if (validationError && !options?.skipValidation) {
                message.warning("Please answer this question before continuing");
                return;
            }
            if (currentIndex >= visibleSegments.length - 1) return;
            const next = visibleSegments[currentIndex + 1];
            setCurrentSegmentKey(next.key);
            await persistNavigation(next.key);
        },
        [
            currentIndex,
            currentSegment,
            persistNavigation,
            validationError,
            visibleSegments,
        ],
    );

    const translateScript = useCallback(
        (text: string) => resolveTokens(text, tokenMap, lead, props.auth),
        [lead, props.auth, tokenMap],
    );

    const selectedBranchKeys = useMemo(() => {
        if (!entrySegment) return [];
        return getBranchOptionKeys(
            templateTree,
            entrySegment,
            answers[entrySegment.key]?.answer_values ?? [],
        );
    }, [answers, entrySegment, templateTree]);

    const completeWithOutcomes = useCallback(
        async (
            outcomes: QualificationOutcome[],
            metadata?: {
                comment?: string | null;
            },
        ): Promise<LeadQualification | null> => {
            if (!outcomes.length) {
                message.warning("Select at least one outcome");
                return null;
            }

            setCompleting(true);
            try {
                await flushPendingSaves();
                const actions = getActionsForSelectedOutcomes(
                    templateTree,
                    outcomes,
                );
                const { qualification: updated, lead: leadPatch } =
                    await service.completeQualification(qualification.id, {
                        outcomes,
                        outcome_comment: metadata?.comment ?? null,
                        selected_branch_keys: selectedBranchKeys,
                        actions,
                    });
                onQualificationUpdated(updated);
                if (leadPatch) {
                    onLeadUpdated?.(leadPatch);
                }
                message.success("Qualification completed");
                return updated;
            } catch (error) {
                message.error(
                    error instanceof Error
                        ? error.message
                        : "Failed to complete qualification",
                );
                throw error;
            } finally {
                setCompleting(false);
            }
        },
        [
            flushPendingSaves,
            onLeadUpdated,
            onQualificationUpdated,
            qualification.id,
            selectedBranchKeys,
            service,
            templateTree,
        ],
    );

    const completeWithOutcome = useCallback(
        async (
            outcome: QualificationOutcome,
            metadata?: {
                comment?: string | null;
            },
        ) => {
            return completeWithOutcomes([outcome], metadata);
        },
        [completeWithOutcomes],
    );

    const abandon = useCallback(async () => {
        setCompleting(true);
        try {
            await service.abandonQualification(qualification.id);
            message.info("Qualification abandoned");
        } catch {
            message.error("Failed to abandon qualification");
        } finally {
            setCompleting(false);
        }
    }, [qualification.id, service]);

    return {
        agentLanguage,
        answers,
        /** Always null — soft-hide replaced the warning modal. */
        branchChangePending: null as BranchChangePending | null,
        canGoBack,
        completing,
        confirmBranchChange: async () => undefined,
        cancelBranchChange: () => undefined,
        currentIndex,
        currentSegment,
        currentSegmentKey,
        goBack,
        goNext,
        jumpToSegment,
        isLastSegment,
        isLastWalkSegment,
        /** Always false for input disabling — use subscribeSaving for the header indicator. */
        saving: false,
        subscribeSaving,
        flushPendingSaves,
        translateScript,
        tokenMap,
        validationError,
        visibleSegments,
        walkSegments,
        walkIndex,
        templateTree,
        applyAnswerChange,
        completeWithOutcome,
        completeWithOutcomes,
        abandon,
    };
};

export default useQualificationFlow;
