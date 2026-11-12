import { useEffect, useState } from "react";
import type { Segment } from "@/Types/qualification";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import { useDynamicTranslations } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import { stripHtmlTags } from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import SayBar from "./SayBar";
import ScriptText from "./ScriptText";
import "./agent-qualify.css";

type QualificationFlow = ReturnType<typeof useQualificationFlow>;

interface StepBodyProps {
    flow: QualificationFlow;
    segment: Segment;
    agentLanguage: string;
    /** 1-based place among the script's questions, for the caption. */
    questionNumber: number;
    questionTotal: number;
}

/**
 * One step of the script in the middle of the qualification (canvas L7-07):
 * a caption, the line to say in a navy bar, or the question with its answer
 * as buttons (single and multiple choice, yes / no) or a text field, and a
 * note field for context from the call. Answers save as they are given.
 */
export default function StepBody({ flow, segment, agentLanguage, questionNumber, questionTotal }: StepBodyProps) {
    const { t } = useTranslation();
    const answer = flow.answers[segment.key];
    const values = answer?.answer_values ?? [];
    const text = answer?.answer_text ?? "";
    const options = segment.options ?? [];
    const labels = useDynamicTranslations(
        options.map((option) => stripHtmlTags(option.label) || option.label),
        { source: "en" },
    );
    const choices = options.map((option, index) => ({ id: option.id, label: labels[index] ?? option.label }));
    const save = (nextValues: string[], nextText: string | null) => flow.applyAnswerChange(segment, nextValues, nextText);

    const isQuestion = segment.type === "question";
    const caption =
        segment.type === "say"
            ? t("pages.agent_workspace.flow.script")
            : segment.type === "instruction"
              ? t("pages.agent_workspace.flow.instruction")
              : t("pages.agent_workspace.flow.question_of", { current: questionNumber, total: questionTotal });

    return (
        <DynamicTranslationProvider locale={agentLanguage}>
            <div className="agent-qs">
                <p className="agent-qs__cap">{caption}</p>

                {segment.type === "say" ? (
                    <SayBar>
                        <ScriptText text={segment.label} translateScript={flow.translateScript} />
                    </SayBar>
                ) : null}

                {segment.type === "instruction" ? (
                    <>
                        <SayBar tone="note">
                            <ScriptText text={segment.label} translateScript={flow.translateScript} />
                        </SayBar>
                        <p className="agent-qs__hint">{t("pages.agent_workspace.flow.instruction_note")}</p>
                    </>
                ) : null}

                {isQuestion ? (
                    <section className="agent-qs__question" aria-labelledby={`qs-${segment.key}`}>
                        <h3 className="agent-qs__title" id={`qs-${segment.key}`}>
                            <ScriptText text={segment.label} translateScript={flow.translateScript} />
                            {segment.required ? (
                                <span className="agent-qs__required" title={t("pages.agent_workspace.flow.required")}>
                                    *
                                </span>
                            ) : null}
                        </h3>

                        {segment.answerType === "singleSelect" || segment.answerType === "multiSelect" ? (
                            <div
                                className="agent-qs__chips"
                                role={segment.answerType === "singleSelect" ? "radiogroup" : "group"}
                                aria-labelledby={`qs-${segment.key}`}
                            >
                                {choices.map((choice) => {
                                    const selected = values.includes(choice.id);
                                    const multi = segment.answerType === "multiSelect";
                                    return (
                                        <button
                                            key={choice.id}
                                            type="button"
                                            role={multi ? undefined : "radio"}
                                            aria-checked={multi ? undefined : selected}
                                            aria-pressed={multi ? selected : undefined}
                                            className={`agent-qs__chip${selected ? " agent-qs__chip--on" : ""}`}
                                            onClick={() => {
                                                const next = multi
                                                    ? selected
                                                        ? values.filter((value) => value !== choice.id)
                                                        : [...values, choice.id]
                                                    : selected
                                                      ? []
                                                      : [choice.id];
                                                void save(next, text || null);
                                            }}
                                        >
                                            {choice.label}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}

                        {segment.answerType === "boolean" ? (
                            <div className="agent-qs__chips" role="radiogroup" aria-labelledby={`qs-${segment.key}`}>
                                {(["true", "false"] as const).map((value) => {
                                    const selected =
                                        values[0] === value || values[0] === (value === "true" ? "yes" : "no");
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            className={`agent-qs__chip${selected ? " agent-qs__chip--on" : ""}`}
                                            onClick={() => void save(selected ? [] : [value], text || null)}
                                        >
                                            {value === "true"
                                                ? t("pages.agent_workspace.flow.yes")
                                                : t("pages.agent_workspace.flow.no")}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}

                        <NoteField
                            key={segment.key}
                            value={text}
                            asAnswer={segment.answerType === "text"}
                            onChange={(next) => void save(segment.answerType === "text" ? [] : values, next || null)}
                            labelledBy={`qs-${segment.key}`}
                        />
                    </section>
                ) : null}
            </div>
        </DynamicTranslationProvider>
    );
}

/** The free-text answer, or for a choice a note with context from the call. */
function NoteField({
    value,
    asAnswer,
    onChange,
    labelledBy,
}: {
    value: string;
    asAnswer: boolean;
    onChange: (value: string) => void;
    labelledBy: string;
}) {
    const { t } = useTranslation();
    // Typing stays local; the flow saves on every change like the classic note does.
    const [draft, setDraft] = useState(value);
    // Follow the answer when it changes from outside this box (a reset, a restored value).
    useEffect(() => {
        setDraft(value);
    }, [value]);
    return (
        <textarea
            className={`agent-qs__note${asAnswer ? " agent-qs__note--answer" : ""}`}
            value={draft}
            rows={asAnswer ? 4 : 2}
            aria-labelledby={asAnswer ? labelledBy : undefined}
            aria-label={asAnswer ? undefined : t("pages.agent_workspace.flow.note_label")}
            placeholder={
                asAnswer
                    ? t("pages.agent_workspace.flow.answer_placeholder")
                    : t("pages.agent_workspace.flow.note_placeholder")
            }
            onChange={(event) => {
                setDraft(event.target.value);
                onChange(event.target.value);
            }}
        />
    );
}
