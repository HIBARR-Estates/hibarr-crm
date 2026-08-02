import { useEffect, useMemo, useState } from "react";
import type {
    LeadQualification,
    TemplateTree,
} from "@/Types/qualification";
import { Modal } from "@/Components/Redesign";
import { getQualificationTemplateService } from "@/Services/QualificationTemplateService";
import {
    computeVisibleSegments,
    formatAnswerDisplay,
    answersFromQualification,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";

const OUTCOME_LABELS: Record<string, string> = {
    bookMeeting: "Consultation booked",
    inviteWebinar: "Webinar invited",
    callback: "Callback requested",
    noFit: "Not a fit",
};

interface AnswersReviewModalProps {
    open: boolean;
    leadName: string;
    history: LeadQualification[];
    current: LeadQualification | null;
    onClose: () => void;
}

interface RunAccordionProps {
    qualification: LeadQualification;
    defaultOpen?: boolean;
}

function RunAccordion({ qualification, defaultOpen = false }: RunAccordionProps) {
    const { td } = useTd();
    const templateService = useMemo(
        () => getQualificationTemplateService(),
        [],
    );
    const [open, setOpen] = useState(defaultOpen);
    const [tree, setTree] = useState<TemplateTree | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || tree) return;
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
    }, [open, qualification.template_id, qualification.template_name, templateService, tree]);

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

    const title = qualification.template_name ?? qualification.template_id;
    const when = qualification.completed_at ?? qualification.created_at;
    const outcomeLabel = qualification.outcome
        ? (OUTCOME_LABELS[qualification.outcome] ?? qualification.outcome)
        : qualification.status;

    return (
        <div
            style={{
                border: "1px solid #e2e5ea",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 10,
            }}
        >
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 14px",
                    background: open ? "#f8f9fb" : "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                }}
            >
                <span style={{ minWidth: 0 }}>
                    <span
                        style={{
                            display: "block",
                            fontWeight: 600,
                            fontSize: 13,
                            color: "#1a1f2e",
                        }}
                    >
                        {title}
                        {qualification.template_version
                            ? ` · v${qualification.template_version}`
                            : ""}
                    </span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        {formatCompanyDateTime(when)}
                        {qualification.agent?.name
                            ? ` · ${qualification.agent.name}`
                            : ""}
                    </span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="v2-pill">{outcomeLabel}</span>
                    <span style={{ color: "#9ca3af" }}>{open ? "▴" : "▾"}</span>
                </span>
            </button>

            {open && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid #e2e5ea" }}>
                    {loading ? (
                        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                            {td("Loading answers…")}
                        </p>
                    ) : visibleSegments.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                            {td("No captured answers.")}
                        </p>
                    ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                            {visibleSegments.map((segment) => {
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

                                if (
                                    segment.type === "say" ||
                                    segment.type === "instruction"
                                ) {
                                    return null;
                                }

                                return (
                                    <div key={segment.key}>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: "#6b7280",
                                                marginBottom: 4,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.04em",
                                            }}
                                        >
                                            {segment.label}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                color: skipped
                                                    ? "#9ca3af"
                                                    : "#1a1f2e",
                                                fontStyle: skipped
                                                    ? "italic"
                                                    : "normal",
                                            }}
                                        >
                                            {skipped
                                                ? td("Skipped")
                                                : display ||
                                                  answer?.answer_text?.trim() ||
                                                  "—"}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
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

    return (
        <Modal
            open={open}
            title={td("Qualification answers")}
            onClose={onClose}
        >
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
                {td("Review captured answers for")}{" "}
                <strong style={{ color: "#1a1f2e" }}>{leadName}</strong>
            </p>

            {runs.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                    {td("No qualification runs yet.")}
                </p>
            ) : (
                runs.map((run, index) => (
                    <RunAccordion
                        key={run.id}
                        qualification={run}
                        defaultOpen={index === 0}
                    />
                ))
            )}
        </Modal>
    );
}
