import { useMemo } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import FlowFooter from "@/Components/Redesign/agent/flow/FlowFooter";
import useSavedAgo from "@/Components/Redesign/agent/flow/qualify/useSavedAgo";
import { AnalysisStep } from "../AnalysisStepStream";
import { completeButtonState } from "../analysisProgress";
import type { AnalysisFlatStep } from "../analysisProgress";
import type { AnalysisSection } from "../types/analysisTypes";
import { AgentAnalysisProvider } from "./AgentAnalysisContext";
import "./agent-analysis.css";

interface AgentAnalysisScreenProps {
    sections: AnalysisSection[];
    /** Every step of the script, in order. */
    steps: AnalysisFlatStep[];
    /** Section being asked right now. */
    activeSection: string;
    onGoToSection: (sectionId: string) => void;
    values: Record<string, any>;
    canEdit: boolean;
    unanswered: Record<string, unknown>;
    filledSteps: ReadonlySet<string>;
    answeredQuestions: ReadonlySet<string>;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => void;
    onFieldChange?: (fieldId: number, value: any) => void;
    onToggleUnanswered: (stepKey: string, on: boolean) => void;
    onQuestionAnswered: (stepKey: string) => void;
    onQuestionCleared: (stepKey: string) => void;
    subscribeSaving: (cb: (saving: boolean) => void) => () => void;
    /** A write the server refused is still open: "Saved" would be untrue. */
    hasFailedSaves: boolean;
    requiredMissing: number;
    totalMissing: number;
    isCompleting: boolean;
    onComplete: () => void;
}

/**
 * The deal analysis under the agent dock (canvas L7-12): one section of the
 * script at a time, "Monthly budget · Question 6 of 9", with every question of
 * it, then back to the section before, when the answers were last saved and
 * on to the next section by name. The last section closes with the
 * completion, which keeps the classic required-steps gate.
 */
export default function AgentAnalysisScreen({
    sections,
    steps,
    activeSection,
    onGoToSection,
    values,
    canEdit,
    unanswered,
    filledSteps,
    answeredQuestions,
    onFieldUpdate,
    onFieldChange,
    onToggleUnanswered,
    onQuestionAnswered,
    onQuestionCleared,
    subscribeSaving,
    hasFailedSaves,
    requiredMissing,
    totalMissing,
    isCompleting,
    onComplete,
}: AgentAnalysisScreenProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const saved = useSavedAgo(subscribeSaving);

    // Sections that hold at least one step, in script order.
    const order = useMemo(() => {
        const ids = new Set(steps.map((step) => step.sectionId));
        return sections.filter((section) => ids.has(section.id));
    }, [sections, steps]);
    const index = Math.max(0, order.findIndex((section) => section.id === activeSection));
    const section = order[index];
    const previous = index > 0 ? order[index - 1] : null;
    const next = index < order.length - 1 ? order[index + 1] : null;
    const sectionSteps = useMemo(() => steps.filter((step) => step.sectionId === section?.id), [steps, section?.id]);

    if (!section) return null;

    const { label: completeLabel, ready } = completeButtonState(requiredMissing, totalMissing, isCompleting);

    return (
        <AgentAnalysisProvider value>
            <div className="agent-an">
                <div className="agent-an__scroll" key={section.id}>
                    <p className="agent-an__cap">
                        {td(section.title, { source: "en" })}
                        {" · "}
                        {t("pages.agent_workspace.flow.question_of", { current: index + 1, total: order.length })}
                    </p>
                    {section.guideText ? <p className="agent-an__guide">{td(section.guideText, { source: "en" })}</p> : null}
                    {sectionSteps.map((step) => (
                        <div className="agent-an__q" key={step.key} data-step-key={step.key}>
                            <AnalysisStep
                                step={step}
                                values={values}
                                canEdit={canEdit}
                                answered={step.kind === "question" ? answeredQuestions.has(step.key) : filledSteps.has(step.key)}
                                marked={step.key in unanswered}
                                answeredQuestions={answeredQuestions}
                                onFieldUpdate={onFieldUpdate}
                                onFieldChange={onFieldChange}
                                onToggleUnanswered={onToggleUnanswered}
                                onQuestionAnswered={onQuestionAnswered}
                                onQuestionCleared={onQuestionCleared}
                            />
                        </div>
                    ))}
                </div>
                <FlowFooter
                    previousLabel={previous ? td(previous.title, { source: "en" }) : null}
                    onPrevious={() => previous && onGoToSection(previous.id)}
                    saved={hasFailedSaves ? "" : saved}
                    nextTone={next || !ready ? "navy" : "green"}
                    nextDisabled={!next && isCompleting}
                    nextLabel={
                        next ? (
                            <>
                                {t("pages.agent_workspace.flow.next")}
                                {": "}
                                {td(next.title, { source: "en" })}
                            </>
                        ) : (
                            td(completeLabel, { source: "en" })
                        )
                    }
                    onNext={() => (next ? onGoToSection(next.id) : onComplete())}
                />
            </div>
        </AgentAnalysisProvider>
    );
}
