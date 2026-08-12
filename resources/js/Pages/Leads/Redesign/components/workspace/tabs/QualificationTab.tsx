import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
    LeadQualification,
    TemplateTree,
} from "@/Types/qualification";
import { COMPLETED_OUTCOME_LABELS, DEFAULT_OUTCOME_LABELS } from "@/Types/qualification";
import { getQualificationTemplateService } from "@/Services/QualificationTemplateService";
import {
    answersFromQualification,
    computeWalkSegments,
    findEntrySegment,
    formatAnswerDisplay,
    hasAnswerContent,
    stripHtmlTags,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { Button, ConfirmDialog, EmptyState, Icon } from "@/Components/Redesign";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";

interface QualificationTabProps {
    current: LeadQualification | null;
    history: LeadQualification[];
    onStartQualify?: () => void;
    onResumeQualify?: (qualification: LeadQualification) => void;
    onDeleteQualify?: (qualification: LeadQualification) => Promise<boolean> | boolean;
    canStart?: boolean;
}

function collectRuns(
    current: LeadQualification | null,
    history: LeadQualification[],
): LeadQualification[] {
    const list = [...history];
    if (current && !list.some((item) => item.id === current.id)) {
        list.unshift(current);
    }
    return list.sort(
        (a, b) =>
            new Date(b.completed_at ?? b.created_at).getTime() -
            new Date(a.completed_at ?? a.created_at).getTime(),
    );
}

export default function QualificationTab({
    current,
    history,
    onStartQualify,
    onResumeQualify,
    onDeleteQualify,
    canStart,
}: QualificationTabProps) {
    const { td } = useTd();
    const runs = useMemo(
        () => collectRuns(current, history),
        [current, history],
    );
    const [expandedId, setExpandedId] = useState<string | null>(() =>
        runs[0] ? String(runs[0].id) : null,
    );
    const treeCacheRef = useRef<Map<string, TemplateTree>>(new Map());
    const [treeCacheVersion, setTreeCacheVersion] = useState(0);

    const getCachedTree = useCallback((templateId: string) => {
        return treeCacheRef.current.get(templateId) ?? null;
    }, []);

    const setCachedTree = useCallback(
        (templateId: string, tree: TemplateTree) => {
            treeCacheRef.current.set(templateId, tree);
            setTreeCacheVersion((version) => version + 1);
        },
        [],
    );

    useEffect(() => {
        if (!runs.length) {
            setExpandedId(null);
            return;
        }
        setExpandedId((prev) => {
            if (prev && runs.some((run) => String(run.id) === prev)) {
                return prev;
            }
            return String(runs[0].id);
        });
    }, [runs]);

    const grouped = useMemo(() => {
        const groups = new Map<
            string,
            { id: string; name: string; runs: LeadQualification[] }
        >();

        for (const run of runs) {
            const id = String(run.template_id || run.template_name || "unknown");
            const name = run.template_name || run.template_id || "Template";
            const existing = groups.get(id);
            if (existing) {
                existing.runs.push(run);
            } else {
                groups.set(id, { id, name, runs: [run] });
            }
        }

        return Array.from(groups.values());
    }, [runs]);

    const answerTotal = runs.reduce(
        (sum, run) => sum + (run.answers?.length ?? 0),
        0,
    );
    const hasResumable = runs.some((run) => run.status === "inProgress");

    return (
        <div>
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs" style={{ color: T.TEXT_MUTED }}>
                    {runs.length}{" "}
                    {runs.length === 1
                        ? td("run", { source: "en" })
                        : td("runs", { source: "en" })}
                    {answerTotal > 0
                        ? ` · ${answerTotal} ${td("answers", { source: "en" })}`
                        : ""}
                    {" · "}
                    {td("grouped by template", { source: "en" })}
                </span>
                <div className="flex items-center gap-2">
                    {canStart && onStartQualify ? (
                        <Button
                            variant={hasResumable ? "ghost" : "primary"}
                            onClick={onStartQualify}
                        >
                            {td("Start qualification", { source: "en" })}
                        </Button>
                    ) : null}
                </div>
            </div>

            {grouped.length === 0 ? (
                <EmptyState
                    title={td("No qualification runs yet", { source: "en" })}
                    description={td(
                        "Answers from each qualification template will appear here after you start a run.",
                        { source: "en" },
                    )}
                />
            ) : (
                <div className="flex flex-col gap-6">
                    {grouped.map((group) => (
                        <section key={group.id}>
                            <div className="flex items-center gap-2 mb-3">
                                <h3
                                    className="m-0 text-sm font-bold"
                                    style={{ color: T.NAVY }}
                                >
                                    {group.name}
                                </h3>
                                <span
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                    style={{
                                        background: T.SURFACE_2,
                                        color: T.TEXT_MUTED,
                                        border: `1px solid ${T.BORDER}`,
                                    }}
                                >
                                    {group.runs.length}{" "}
                                    {group.runs.length === 1
                                        ? td("run", { source: "en" })
                                        : td("runs", { source: "en" })}
                                </span>
                            </div>
                            <div className="flex flex-col gap-3">
                                {group.runs.map((run) => (
                                    <QualificationRunCard
                                        key={run.id}
                                        qualification={run}
                                        expanded={
                                            expandedId === String(run.id)
                                        }
                                        treeCacheVersion={treeCacheVersion}
                                        getCachedTree={getCachedTree}
                                        setCachedTree={setCachedTree}
                                        onToggle={() =>
                                            setExpandedId((currentId) =>
                                                currentId === String(run.id)
                                                    ? null
                                                    : String(run.id),
                                            )
                                        }
                                        onResume={
                                            onResumeQualify
                                                ? () => onResumeQualify(run)
                                                : undefined
                                        }
                                        onDelete={
                                            onDeleteQualify
                                                ? () => onDeleteQualify(run)
                                                : undefined
                                        }
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}

function QualificationRunCard({
    qualification,
    expanded,
    onToggle,
    onResume,
    onDelete,
    treeCacheVersion,
    getCachedTree,
    setCachedTree,
}: {
    qualification: LeadQualification;
    expanded: boolean;
    onToggle: () => void;
    onResume?: () => void;
    onDelete?: () => Promise<boolean> | boolean;
    treeCacheVersion: number;
    getCachedTree: (templateId: string) => TemplateTree | null;
    setCachedTree: (templateId: string, tree: TemplateTree) => void;
}) {
    const { td } = useTd();
    const templateService = useMemo(
        () => getQualificationTemplateService(),
        [],
    );
    const cachedTree = getCachedTree(qualification.template_id);
    const [tree, setTree] = useState<TemplateTree | null>(cachedTree);
    const [enhancing, setEnhancing] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const fromCache = getCachedTree(qualification.template_id);
        if (fromCache) {
            setTree(fromCache);
        }
    }, [getCachedTree, qualification.template_id, treeCacheVersion]);

    // Fetch the template tree only when expanded — answers render immediately
    // from stored values, and the tree upgrades labels in place when ready.
    useEffect(() => {
        if (!expanded || tree) return;
        let cancelled = false;

        const load = async () => {
            setEnhancing(true);
            try {
                const response = await templateService.getTemplateTree(
                    qualification.template_id,
                    qualification.template_name,
                );
                if (cancelled) return;
                setTree(response.data);
                setCachedTree(qualification.template_id, response.data);
            } catch {
                // Keep showing the raw-answer fallback; no empty-state flip.
            } finally {
                if (!cancelled) setEnhancing(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [
        expanded,
        qualification.template_id,
        qualification.template_name,
        setCachedTree,
        templateService,
        tree,
    ]);

    const answerMap = useMemo(
        () =>
            answersFromQualification(
                qualification.answers ?? [],
                tree ?? undefined,
            ),
        [qualification.answers, tree],
    );

    const entrySegment = useMemo(
        () => (tree ? findEntrySegment(tree) : undefined),
        [tree],
    );

    const mainAnswerDisplay = useMemo(() => {
        if (!entrySegment) return "";
        const answer = answerMap[entrySegment.key];
        if (!hasAnswerContent(answer)) return "";
        return stripHtmlTags(formatAnswerDisplay(entrySegment, answer));
    }, [answerMap, entrySegment]);

    const questionSegments = useMemo(() => {
        if (!tree) return [];
        return computeWalkSegments(tree, answerMap).filter(
            (segment) => segment.type === "question",
        );
    }, [answerMap, tree]);

    const answerCount = (qualification.answers ?? []).length;
    const when = qualification.completed_at ?? qualification.created_at;
    const selectedOutcomes = (
        qualification.outcomes?.length
            ? qualification.outcomes
            : qualification.outcome
              ? [qualification.outcome]
              : []
    )
        .map((key) => (typeof key === "string" ? key : String(key)))
        .filter(Boolean);

    const statusLabel =
        qualification.status === "completed"
            ? td("Completed", { source: "en" })
            : qualification.status === "inProgress"
              ? td("In progress", { source: "en" })
              : qualification.status === "abandoned"
                ? td("Abandoned", { source: "en" })
                : td("In progress", { source: "en" });

    const outcomeLabels = selectedOutcomes.map((key) =>
        td(
            COMPLETED_OUTCOME_LABELS[key as keyof typeof COMPLETED_OUTCOME_LABELS] ??
                DEFAULT_OUTCOME_LABELS[key as keyof typeof DEFAULT_OUTCOME_LABELS] ??
                key,
            { source: "en" },
        ),
    );
    const outcomeSummary = outcomeLabels.join(" · ");
    const canResume = qualification.status === "inProgress" && Boolean(onResume);

    const statusTone =
        qualification.status === "completed"
            ? { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" }
            : qualification.status === "inProgress"
              ? { bg: "#e8f1fb", color: T.NAVY, border: "#bfdbfe" }
              : { bg: T.SURFACE_2, color: T.TEXT_MUTED, border: T.BORDER };

    const outcomeTone = {
        bg: "#fff7ed",
        color: "#9a3412",
        border: "#fed7aa",
    };

    const mainTone = {
        bg: "#e8f1fb",
        color: T.NAVY,
        border: "#bfdbfe",
    };

    const handleDeleteConfirm = async () => {
        if (!onDelete || deleting) return;
        setDeleting(true);
        try {
            const ok = await onDelete();
            if (ok) setConfirmDeleteOpen(false);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div
            className="rounded-xl overflow-hidden"
            style={{
                border: `1px solid ${T.BORDER}`,
                background: "#fff",
            }}
        >
            <div
                className="flex items-stretch gap-2 px-4 py-3.5"
                style={{ background: T.SURFACE_2 }}
            >
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex-1 min-w-0 text-left flex items-center gap-3 transition-colors"
                >
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                                style={{
                                    background: statusTone.bg,
                                    color: statusTone.color,
                                    border: `1px solid ${statusTone.border}`,
                                }}
                            >
                                {statusLabel}
                            </span>
                            {mainAnswerDisplay ? (
                                <span
                                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold max-w-full"
                                    style={{
                                        background: mainTone.bg,
                                        color: mainTone.color,
                                        border: `1px solid ${mainTone.border}`,
                                    }}
                                    title={mainAnswerDisplay}
                                >
                                    <span className="uppercase tracking-wide opacity-80 shrink-0">
                                        {td("Main", { source: "en" })}
                                    </span>
                                    <span className="truncate">
                                        {mainAnswerDisplay}
                                    </span>
                                </span>
                            ) : null}
                            {outcomeSummary ? (
                                <span
                                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold max-w-full"
                                    style={{
                                        background: outcomeTone.bg,
                                        color: outcomeTone.color,
                                        border: `1px solid ${outcomeTone.border}`,
                                    }}
                                    title={outcomeSummary}
                                >
                                    <span className="uppercase tracking-wide opacity-80 shrink-0">
                                        {td("Outcome", { source: "en" })}
                                    </span>
                                    <span className="truncate">
                                        {outcomeSummary}
                                    </span>
                                </span>
                            ) : null}
                            <span
                                className="text-[12px] font-semibold tabular-nums"
                                style={{ color: T.TEXT }}
                            >
                                {answerCount} {td("answers", { source: "en" })}
                            </span>
                        </div>
                        <div
                            className="text-[12px]"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {formatCompanyDateTime(when)}
                            {qualification.agent?.name
                                ? ` · ${qualification.agent.name}`
                                : ""}
                        </div>
                        {qualification.outcome_comment?.trim() ? (
                            <p
                                className="mt-1.5 mb-0 text-[12px] italic line-clamp-2"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                “{qualification.outcome_comment.trim()}”
                            </p>
                        ) : null}
                    </div>
                    <Icon
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={16}
                    />
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                    {canResume ? (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={(event) => {
                                event.stopPropagation();
                                onResume?.();
                            }}
                        >
                            {td("Resume", { source: "en" })}
                        </Button>
                    ) : null}
                    {onDelete ? (
                        <button
                            type="button"
                            aria-label={td("Delete run", { source: "en" })}
                            title={td("Delete run", { source: "en" })}
                            onClick={(event) => {
                                event.stopPropagation();
                                setConfirmDeleteOpen(true);
                            }}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors"
                            style={{
                                borderColor: T.BORDER,
                                background: "#fff",
                                color: "#b91c1c",
                            }}
                        >
                            <Icon name="trash" size={16} />
                        </button>
                    ) : null}
                </div>
            </div>

            {expanded ? (
                <div
                    className="px-4 py-4 flex flex-col gap-3"
                    style={{ borderTop: `1px solid ${T.BORDER}` }}
                >
                    {questionSegments.length > 0 ? (
                        questionSegments.map((segment, index) => {
                            const answer = answerMap[segment.key];
                            const answered = hasAnswerContent(answer);
                            const display = stripHtmlTags(
                                formatAnswerDisplay(segment, answer),
                            );
                            const context = answer?.answer_text?.trim() ?? "";
                            const question =
                                stripHtmlTags(segment.label) || segment.key;
                            const showContext =
                                answered &&
                                segment.answerType !== "text" &&
                                Boolean(context) &&
                                context !== display;

                            return (
                                <div
                                    key={segment.key}
                                    className="rounded-lg px-3.5 py-3"
                                    style={{
                                        background: answered
                                            ? "#f8fafc"
                                            : "#fff",
                                        border: `1px solid ${T.BORDER}`,
                                    }}
                                >
                                    <div className="flex gap-3">
                                        <div
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                                            style={
                                                answered
                                                    ? {
                                                          background:
                                                              "#d1fae5",
                                                          color: "#065f46",
                                                      }
                                                    : {
                                                          background:
                                                              "#f1f5f9",
                                                          color: "#94a3b8",
                                                      }
                                            }
                                        >
                                            {answered ? "✓" : index + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p
                                                className="m-0 text-[13px] leading-snug mb-2"
                                                style={{ color: T.TEXT }}
                                            >
                                                {question}
                                            </p>
                                            {answered ? (
                                                <div
                                                    className="rounded-md px-3 py-2"
                                                    style={{
                                                        background: "#e8f1fb",
                                                        border: `1px solid #bfdbfe`,
                                                    }}
                                                >
                                                    <div
                                                        className="text-[10px] font-bold uppercase tracking-widest mb-1"
                                                        style={{
                                                            color: T.NAVY,
                                                        }}
                                                    >
                                                        {td("Answer", {
                                                            source: "en",
                                                        })}
                                                    </div>
                                                    <p
                                                        className="m-0 text-[14px] font-semibold leading-snug break-words"
                                                        style={{
                                                            color: T.TEXT,
                                                        }}
                                                    >
                                                        {display ||
                                                            context ||
                                                            "—"}
                                                    </p>
                                                    {showContext ? (
                                                        <p
                                                            className="mt-1.5 mb-0 text-[12px] leading-snug"
                                                            style={{
                                                                color: T.TEXT_MUTED,
                                                            }}
                                                        >
                                                            {context}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <p
                                                    className="m-0 text-[13px] italic"
                                                    style={{
                                                        color: T.TEXT_HINT,
                                                    }}
                                                >
                                                    {td(
                                                        "Skipped / unanswered",
                                                        { source: "en" },
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <AnswerRowsFallback qualification={qualification} />
                    )}
                    {enhancing && questionSegments.length === 0 ? (
                        <p
                            className="m-0 text-[11px]"
                            style={{ color: T.TEXT_HINT }}
                        >
                            {td("Loading question labels…", { source: "en" })}
                        </p>
                    ) : null}
                </div>
            ) : null}

            <ConfirmDialog
                open={confirmDeleteOpen}
                title={td("Delete qualification run?", { source: "en" })}
                message={td(
                    "This permanently removes the run and its answers. This cannot be undone.",
                    { source: "en" },
                )}
                confirmLabel={td("Delete", { source: "en" })}
                cancelLabel={td("Cancel", { source: "en" })}
                danger
                confirmLoading={deleting}
                onConfirm={() => void handleDeleteConfirm()}
                onCancel={() => {
                    if (!deleting) setConfirmDeleteOpen(false);
                }}
            />
        </div>
    );
}

/** When the template tree isn't ready yet, still show raw stored answers. */
function AnswerRowsFallback({
    qualification,
}: {
    qualification: LeadQualification;
}) {
    const { td } = useTd();
    const answers = qualification.answers ?? [];

    if (!answers.length) {
        return (
            <p className="m-0 text-sm" style={{ color: T.TEXT_HINT }}>
                {td("No captured answers.", { source: "en" })}
            </p>
        );
    }

    return (
        <>
            {answers.map((answer, index) => {
                const values = (answer.answer_values ?? []).join(", ");
                const context = answer.answer_text?.trim() ?? "";
                return (
                    <div
                        key={answer.id ?? `${answer.segment_key}-${index}`}
                        className="rounded-lg px-3.5 py-3"
                        style={{
                            background: "#f8fafc",
                            border: `1px solid ${T.BORDER}`,
                        }}
                    >
                        <p
                            className="m-0 text-[12px] mb-1.5"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {answer.segment_key}
                        </p>
                        <p
                            className="m-0 text-[14px] font-semibold"
                            style={{ color: T.TEXT }}
                        >
                            {values || context || "—"}
                        </p>
                        {values && context && context !== values ? (
                            <p
                                className="mt-1 mb-0 text-[12px]"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {context}
                            </p>
                        ) : null}
                    </div>
                );
            })}
        </>
    );
}
