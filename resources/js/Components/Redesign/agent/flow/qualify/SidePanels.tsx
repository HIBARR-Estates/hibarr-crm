import { useMemo } from "react";
import type { Segment, SegmentAnswerState } from "@/Types/qualification";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { formatAnswerDisplay, hasAnswerContent, stripHtmlTags } from "@/Components/Redesign/qualification/qualificationUtils";
import { useTranslatedScriptLabel } from "@/Components/Redesign/qualification/useTranslatedScriptLabel";
import "./agent-qualify.css";

export interface FactRow {
    key: string;
    label: string;
    value: string | null;
}

/** Label left, value right, a hairline between rows (canvas L7-07, L7-08). */
export function FactRows({ rows }: { rows: FactRow[] }) {
    const { t } = useTranslation();
    return (
        <dl className="agent-qs__rows">
            {rows.map((row) => (
                <div className="agent-qs__row" key={row.key}>
                    <dt>{row.label}</dt>
                    <dd className={row.value ? undefined : "agent-qs__row-empty"}>
                        {row.value || t("pages.agent_workspace.flow.not_set")}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

interface AnswerRowsProps {
    segments: Segment[];
    answers: Record<string, SegmentAnswerState>;
    translateScript: (text: string) => string;
    onJump: (key: string) => void;
}

/** Each question of the script with its answer, or "Not asked yet"; a row opens its step. */
export function AnswerRows({ segments, answers, translateScript, onJump }: AnswerRowsProps) {
    const questions = useMemo(() => segments.filter((segment) => segment.type === "question"), [segments]);
    return (
        <dl className="agent-qs__rows">
            {questions.map((segment) => (
                <AnswerRow
                    key={segment.key}
                    segment={segment}
                    answer={answers[segment.key]}
                    translateScript={translateScript}
                    onJump={onJump}
                />
            ))}
        </dl>
    );
}

function AnswerRow({
    segment,
    answer,
    translateScript,
    onJump,
}: {
    segment: Segment;
    answer?: SegmentAnswerState;
    translateScript: (text: string) => string;
    onJump: (key: string) => void;
}) {
    const { t } = useTranslation();
    const rawLabel = useTranslatedScriptLabel(segment.label || segment.key);
    const question = stripHtmlTags(translateScript(rawLabel)) || segment.key;
    const rawAnswer = formatAnswerDisplay(segment, answer);
    const translated = useDynamicTranslation(stripHtmlTags(rawAnswer) || rawAnswer, { source: "en" });
    // A note written next to a chosen option is context for it; a text question's answer is the note itself.
    const note = segment.answerType === "text" ? "" : (answer?.answer_text?.trim() ?? "");
    const choice = rawAnswer ? translateScript(translated) : "";
    const value = hasAnswerContent(answer) ? [choice, note].filter(Boolean).join(" · ") || "—" : "";
    return (
        <div className="agent-qs__row">
            <dt>
                <button type="button" className="agent-qs__row-link" onClick={() => onJump(segment.key)}>
                    {question}
                </button>
            </dt>
            <dd className={value ? undefined : "agent-qs__row-empty"}>{value || t("pages.agent_workspace.flow.not_asked")}</dd>
        </div>
    );
}
