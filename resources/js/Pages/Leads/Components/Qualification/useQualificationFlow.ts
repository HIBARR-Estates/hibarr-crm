import { useCallback, useEffect, useMemo, useState } from "react";
import { message } from "antd";
import { usePage } from "@inertiajs/react";
import { Lead } from "@/Types/api/leads";
import {
    LeadQualification,
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
    findEntrySegment,
    getBranchOptionKeys,
    getBranchSegmentKeysToClear,
    mapOptionIdsToStoredValues,
    resolveTokens,
    validateSegmentAnswer,
} from "./qualificationUtils";

export interface UseQualificationFlowOptions {
    lead: Lead;
    qualification: LeadQualification;
    templateTree: TemplateTree;
    service: LeadQualificationService;
    registrationService: RegistrationService;
    agentLanguage: string;
    onQualificationUpdated: (qualification: LeadQualification) => void;
}

export interface BranchChangePending {
    segmentKey: string;
    newValues: string[];
    newText?: string | null;
}

const splitLeadName = (name?: string | null) => {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
    };
};

export const useQualificationFlow = ({
    lead,
    qualification,
    templateTree,
    service,
    registrationService,
    agentLanguage,
    onQualificationUpdated,
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
    const [saving, setSaving] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [branchChangePending, setBranchChangePending] =
        useState<BranchChangePending | null>(null);

    const entrySegment = useMemo(
        () => findEntrySegment(templateTree),
        [templateTree],
    );

    const visibleSegments = useMemo(
        () => computeVisibleSegments(templateTree, answers),
        [templateTree, answers],
    );

    const currentIndex = useMemo(
        () => visibleSegments.findIndex((s) => s.key === currentSegmentKey),
        [visibleSegments, currentSegmentKey],
    );

    const currentSegment: Segment | undefined =
        currentIndex >= 0 ? visibleSegments[currentIndex] : visibleSegments[0];

    useEffect(() => {
        if (
            currentSegmentKey &&
            !visibleSegments.some((s) => s.key === currentSegmentKey)
        ) {
            const fallback =
                visibleSegments[Math.min(currentIndex, visibleSegments.length - 1)] ??
                visibleSegments[0];
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

    const saveAnswer = useCallback(
        async (
            segment: Segment,
            values: string[],
            text?: string | null,
        ): Promise<void> => {
            const storedValues = mapOptionIdsToStoredValues(segment, values);

            setSaving(true);
            try {
                await service.upsertAnswer(qualification.id, {
                    segment_key: segment.key,
                    answer_values: storedValues,
                    answer_text: text ?? null,
                });

                setAnswers((prev) => ({
                    ...prev,
                    [segment.key]: {
                        answer_values: values,
                        answer_text: text ?? null,
                    },
                }));
            } catch {
                message.error("Failed to save answer");
                throw new Error("save failed");
            } finally {
                setSaving(false);
            }
        },
        [qualification.id, service],
    );

    const applyAnswerChange = useCallback(
        async (
            segment: Segment,
            values: string[],
            text?: string | null,
        ): Promise<void> => {
            const isEntry =
                segment.isEntryQuestion ||
                (entrySegment && segment.key === entrySegment.key);
            const previousEntryValues = entrySegment
                ? (answers[entrySegment.key]?.answer_values ?? [])
                : [];
            const branchChanged =
                isEntry &&
                previousEntryValues.length > 0 &&
                (values.length !== previousEntryValues.length ||
                    values.some((v) => !previousEntryValues.includes(v)));

            if (branchChanged) {
                setBranchChangePending({
                    segmentKey: segment.key,
                    newValues: values,
                    newText: text,
                });
                return;
            }

            await saveAnswer(segment, values, text);
        },
        [answers, entrySegment, saveAnswer],
    );

    const confirmBranchChange = useCallback(async () => {
        if (!branchChangePending || !entrySegment) {
            return;
        }

        const segmentKeysToClear = getBranchSegmentKeysToClear(
            templateTree,
            entrySegment,
        );
        const storedValues = mapOptionIdsToStoredValues(
            entrySegment,
            branchChangePending.newValues,
        );

        setSaving(true);
        try {
            if (segmentKeysToClear.length > 0) {
                await service.clearBranchAnswers(
                    qualification.id,
                    segmentKeysToClear,
                );
            }

            await service.upsertAnswer(qualification.id, {
                segment_key: branchChangePending.segmentKey,
                answer_values: storedValues,
                answer_text: branchChangePending.newText ?? null,
            });

            setAnswers({
                [branchChangePending.segmentKey]: {
                    answer_values: branchChangePending.newValues,
                    answer_text: branchChangePending.newText ?? null,
                },
            });
            setBranchChangePending(null);

            const visible = computeVisibleSegments(templateTree, {
                [branchChangePending.segmentKey]: {
                    answer_values: branchChangePending.newValues,
                    answer_text: branchChangePending.newText ?? null,
                },
            });
            const nextKey = visible.find((s) => s.key !== entrySegment.key)?.key;
            if (nextKey) {
                setCurrentSegmentKey(nextKey);
                await persistNavigation(nextKey);
            }
        } catch {
            message.error("Failed to update branch");
        } finally {
            setSaving(false);
        }
    }, [
        branchChangePending,
        entrySegment,
        persistNavigation,
        qualification.id,
        service,
        templateTree,
    ]);

    const cancelBranchChange = useCallback(() => {
        setBranchChangePending(null);
    }, []);

    const canGoBack = currentIndex > 0;
    const isLastSegment = currentIndex === visibleSegments.length - 1;

    const validationError = currentSegment
        ? validateSegmentAnswer(currentSegment, answers[currentSegment.key])
        : null;

    const goBack = useCallback(async () => {
        if (!canGoBack) return;
        const prev = visibleSegments[currentIndex - 1];
        setCurrentSegmentKey(prev.key);
        await persistNavigation(prev.key);
    }, [canGoBack, currentIndex, persistNavigation, visibleSegments]);

    const goNext = useCallback(async (options?: { skipValidation?: boolean }) => {
        if (!currentSegment) return;
        // `skipValidation` backs the Skip control — the agent may move past a
        // question the lead would not answer without inventing a value for it.
        if (validationError && !options?.skipValidation) {
            message.warning("Please answer this question before continuing");
            return;
        }
        if (currentIndex >= visibleSegments.length - 1) return;
        const next = visibleSegments[currentIndex + 1];
        setCurrentSegmentKey(next.key);
        await persistNavigation(next.key);
    }, [
        currentIndex,
        currentSegment,
        persistNavigation,
        validationError,
        visibleSegments,
    ]);

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

    const completeWithOutcome = useCallback(
        async (
            outcome: QualificationOutcome,
            metadata?: {
                webinarSessionId?: string;
                webinarSessionLabel?: string;
                calendlyUrl?: string;
            },
        ) => {
            setCompleting(true);
            try {
                const { firstName, lastName } = splitLeadName(lead.client_name);
                const marketing = lead.marketing;
                const registrationPayload = {
                    email: lead.client_email ?? "",
                    firstName,
                    lastName,
                    phone: lead.mobile ?? lead.cell ?? undefined,
                    leadId: lead.id,
                    language: agentLanguage,
                    country: lead.country ?? undefined,
                    city: lead.city ?? undefined,
                    state: lead.state ?? undefined,
                    zipCode: lead.postal_code ?? undefined,
                    gender: lead.gender ?? undefined,
                    utmInfo: marketing?.utm_source
                        ? {
                              utmSource: marketing.utm_source,
                              utmMedium: marketing.utm_medium ?? undefined,
                              utmCampaign: marketing.utm_campaign ?? undefined,
                              utmTerm: marketing.utm_term ?? undefined,
                              utmContent: marketing.utm_content ?? undefined,
                          }
                        : undefined,
                };

                if (outcome === "bookMeeting") {
                    await registrationService.bookConsultationCalendly({
                        ...registrationPayload,
                        calendlyUrl: metadata?.calendlyUrl,
                    });
                } else if (outcome === "inviteWebinar") {
                    if (!metadata?.webinarSessionId) {
                        throw new Error("Webinar session required");
                    }
                    await registrationService.registerWebinarSession(
                        metadata.webinarSessionId,
                        registrationPayload,
                    );
                }

                const updated = await service.completeQualification(
                    qualification.id,
                    {
                        outcome,
                        selected_branch_keys: selectedBranchKeys,
                        webinar_session_label: metadata?.webinarSessionLabel,
                    },
                );
                onQualificationUpdated(updated);
                message.success("Qualification completed");
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
            agentLanguage,
            lead,
            onQualificationUpdated,
            qualification.id,
            registrationService,
            selectedBranchKeys,
            service,
        ],
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
        branchChangePending,
        canGoBack,
        completing,
        confirmBranchChange,
        cancelBranchChange,
        currentIndex,
        currentSegment,
        goBack,
        goNext,
        isLastSegment,
        saving,
        translateScript,
        tokenMap,
        validationError,
        visibleSegments,
        applyAnswerChange,
        completeWithOutcome,
        abandon,
    };
};

export default useQualificationFlow;
