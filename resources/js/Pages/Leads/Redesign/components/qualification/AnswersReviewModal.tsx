import { useEffect, useMemo, useState } from "react";
import type {
    LeadQualification,
    TemplateTree,
} from "@/Types/qualification";
import { COMPLETED_OUTCOME_LABELS } from "@/Types/qualification";
import { getQualificationTemplateService } from "@/Services/QualificationTemplateService";
import {
    computeVisibleSegments,
    formatAnswerDisplay,
    answersFromQualification,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import Icon from "@/Components/Redesign/primitives/Icon";
import LeadV2Modal, {
    LeadV2ModalFooter,
    LeadV2ModalHeader,
} from "./LeadV2Modal";

interface AnswersReviewModalProps {
    open: boolean;
    leadName: string;
    history: LeadQualification[];
    current: LeadQualification | null;
    onClose: () => void;
}

interface RunCardProps {
    qualification: LeadQualification;
    expanded: boolean;
    onToggle: () => void;
}

function RunCard({ qualification, expanded, onToggle }: RunCardProps) {
    const { td } = useTd();
    const { formatDateTime } = useUserDateTime();
    const templateService = useMemo(
        () => getQualificationTemplateService(),
        [],
    );
    const [tree, setTree] = useState<TemplateTree | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!expanded || tree) return;
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const response = await templateService.getTemplateTree(
                    qualification.template_id,
                    qualification.template_name,
                );
                if (!cancelled) setTree(response.data);
            } catch {
                if (!cancelled) setTree(null);
            } finally {
                if (!cancelled) setLoading(false);
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

    const visibleSegments = useMemo(() => {
        if (!tree) return [];
        return computeVisibleSegments(tree, answerMap);
    }, [answerMap, tree]);

    const answeredKeys = new Set(
        (qualification.answers ?? []).map((a) => a.segment_key),
    );
    const answerCount = (qualification.answers ?? []).length;
    const when = qualification.completed_at ?? qualification.created_at;
    const selectedOutcomes =
        qualification.outcomes?.length
            ? qualification.outcomes
            : qualification.outcome
              ? [qualification.outcome]
              : [];
    const outcomeLabel = selectedOutcomes.length
        ? selectedOutcomes
              .map((key) =>
                  td(COMPLETED_OUTCOME_LABELS[key] ?? key, { source: "en" }),
              )
              .join(" · ")
        : qualification.status === "inProgress"
          ? td("In progress", { source: "en" })
          : qualification.status === "completed"
            ? td("Completed", { source: "en" })
            : qualification.status === "abandoned"
              ? td("Abandoned", { source: "en" })
              : td("In progress", { source: "en" });
    const winnerLabel = qualification.outcome
        ? td(COMPLETED_OUTCOME_LABELS[qualification.outcome] ??
                  qualification.outcome, { source: "en" })
        : null;

    return (
        <div className="v2-answers-run">
            <button
                type="button"
                className="v2-answers-run-head"
                onClick={onToggle}
            >
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 650 }}>
                        {outcomeLabel}
                    </div>
                    {winnerLabel && selectedOutcomes.length > 1 ? (
                        <div
                            style={{
                                fontSize: 11,
                                color: "var(--lr-text-muted)",
                                marginTop: 2,
                            }}
                        >
                            {td("Lifecycle", { source: "en" })}: {winnerLabel}
                        </div>
                    ) : null}
                    {qualification.outcome_comment?.trim() ? (
                        <div
                            style={{
                                fontSize: 11,
                                color: "var(--lr-text-muted)",
                                marginTop: 2,
                                fontStyle: "italic",
                            }}
                        >
                            “{qualification.outcome_comment.trim()}”
                        </div>
                    ) : null}
                    <div
                        style={{
                            fontSize: 11,
                            color: "var(--lr-text-dim)",
                            marginTop: 2,
                        }}
                    >
                        {formatDateTime(when)}
                        {" · "}
                        {answerCount} {td("answers", { source: "en" })}
                        {qualification.agent?.name
                            ? ` · ${qualification.agent.name}`
                            : ""}
                    </div>
                </div>
                <Icon
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={14}
                />
            </button>

            {expanded ? (
                <div className="v2-answers-run-body">
                    {loading ? (
                        <p
                            style={{
                                margin: 0,
                                fontSize: 12,
                                color: "var(--lr-text-dim)",
                            }}
                        >
                            {td("Loading answers…", { source: "en" })}
                        </p>
                    ) : visibleSegments.length === 0 ? (
                        <p
                            style={{
                                margin: 0,
                                fontSize: 12,
                                color: "var(--lr-text-dim)",
                            }}
                        >
                            {td("No captured answers.", { source: "en" })}
                        </p>
                    ) : (
                        visibleSegments.map((segment, index) => {
                            if (
                                segment.type === "say" ||
                                segment.type === "instruction"
                            ) {
                                return null;
                            }

                            const answer = answerMap[segment.key];
                            const hasStoredAnswer = answeredKeys.has(
                                segment.key,
                            );
                            const isQuestion = segment.type === "question";
                            const display = formatAnswerDisplay(
                                segment,
                                answer,
                            );
                            const skipped =
                                isQuestion &&
                                !hasStoredAnswer &&
                                !display.trim();
                            const context = answer?.answer_text?.trim();

                            return (
                                <div key={segment.key}>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "var(--lr-text-dim)",
                                            marginBottom: 2,
                                        }}
                                    >
                                        {index + 1}. {segment.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 13.5,
                                            fontWeight: skipped ? 400 : 650,
                                            color: skipped
                                                ? "var(--lr-text-dim)"
                                                : "var(--lr-text)",
                                            fontStyle: skipped
                                                ? "italic"
                                                : "normal",
                                        }}
                                    >
                                        {skipped
                                            ? td("Skipped / unanswered", { source: "en" })
                                            : display || context || "—"}
                                    </div>
                                    {!skipped &&
                                    context &&
                                    display &&
                                    context !== display ? (
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "var(--lr-text-muted)",
                                                marginTop: 4,
                                                fontStyle: "italic",
                                            }}
                                        >
                                            “{context}”
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })
                    )}
                </div>
            ) : null}
        </div>
    );
}

export default function AnswersReviewModal({
    open,
    leadName,
    history,
    current,
    onClose,
}: AnswersReviewModalProps) {
    const { td } = useTd();
    const titleId = "answers-review-title";
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const runs = useMemo(() => {
        const list = [...history];
        if (current && !list.some((item) => item.id === current.id)) {
            list.unshift(current);
        }
        return list.sort(
            (a, b) =>
                new Date(b.completed_at ?? b.created_at).getTime() -
                new Date(a.completed_at ?? a.created_at).getTime(),
        );
    }, [current, history]);

    const grouped = useMemo(() => {
        const groups = new Map<
            string,
            { id: string; name: string; runs: LeadQualification[] }
        >();

        for (const run of runs) {
            const id = run.template_id || run.template_name || "unknown";
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

    useEffect(() => {
        if (open && runs.length) {
            setExpandedId(String(runs[0].id));
        }
        if (!open) setExpandedId(null);
    }, [open, runs]);

    return (
        <LeadV2Modal
            open={open}
            onClose={onClose}
            labelledBy={titleId}
            ariaLabel={td("Qualification history", { source: "en" })}
            maxWidth={560}
        >
            <LeadV2ModalHeader
                title={td("Qualification history", { source: "en" })}
                titleId={titleId}
                subtitle={
                    <>
                        {leadName} · {td("grouped by template", { source: "en" })}
                    </>
                }
                onClose={onClose}
            />

            <div
                className="v2-modal-body"
                style={{ maxHeight: "60vh", overflow: "auto", paddingBottom: 20 }}
            >
                {grouped.length === 0 ? (
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            color: "var(--lr-text-dim)",
                        }}
                    >
                        {td("No qualification runs recorded yet.", { source: "en" })}
                    </p>
                ) : (
                    <div className="v2-answers-group">
                        {grouped.map((group) => (
                            <section key={group.id}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: 10,
                                    }}
                                >
                                    <h3
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: "var(--lr-navy)",
                                        }}
                                    >
                                        {group.name}
                                    </h3>
                                    <span className="v2-pill v2-pill-gray">
                                        {group.runs.length}{" "}
                                        {group.runs.length === 1
                                            ? td("run", { source: "en" })
                                            : td("runs", { source: "en" })}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                    }}
                                >
                                    {group.runs.map((run) => (
                                        <RunCard
                                            key={run.id}
                                            qualification={run}
                                            expanded={
                                                expandedId === String(run.id)
                                            }
                                            onToggle={() =>
                                                setExpandedId((currentId) =>
                                                    currentId ===
                                                    String(run.id)
                                                        ? null
                                                        : String(run.id),
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>

            <LeadV2ModalFooter style={{ justifyContent: "flex-end" }}>
                <button
                    type="button"
                    className="v2-btn v2-btn-primary"
                    onClick={onClose}
                >
                    {td("Close", { source: "en" })}
                </button>
            </LeadV2ModalFooter>
        </LeadV2Modal>
    );
}
