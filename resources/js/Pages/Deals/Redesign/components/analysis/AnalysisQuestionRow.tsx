import { useMemo, useState } from "react";
import { useFormData } from "@/Hooks/useFormData";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealNoteCreate from "../../hooks/useDealNoteCreate";
import DealSwitch from "../primitives/DealSwitch";
import AnalysisFieldRow from "./center/AnalysisFieldRow";
import { FormField } from "./AnalysisCustomFieldForm";
import { ANALYSIS_FIELD_META } from "../../config/analysisFieldMeta";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import type { AnalysisSectionItem } from "./types/analysisTypes";

interface Props {
    item: AnalysisSectionItem;
    number?: number;
    canEdit: boolean;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => void;
    /** Fired once the answer note is saved — settles a required question. */
    onAnswered?: () => void;
    /** Owned by the modal so "Clear answer" can take the tick back. */
    answered?: boolean;
}

function InstructionCard({ text }: { text: string }) {
    return (
        <div
            className="flex items-start gap-2.5 rounded-md px-3 py-2.5 my-3 border border-amber-200"
            style={{ background: "#fffbeb" }}
        >
            <svg
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: "#d97706" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
            </svg>
            <p className="text-xs leading-relaxed" style={{ color: "#78350f" }}>{text}</p>
        </div>
    );
}

export default function AnalysisQuestionRow({
    item,
    number,
    canEdit,
    onFieldUpdate,
    onAnswered,
    answered = false,
}: Props) {
    const { deal } = useDealWorkspace();
    const { createNote, isSaving } = useDealNoteCreate(deal.id);
    const [answer, setAnswer] = useState("");

    const meta = ANALYSIS_FIELD_META[item.scriptItem.item_key];
    const label = item.scriptItem.label_override || meta?.label || item.scriptItem.item_key;

    // Prompt body lives in guide_text, but scripts authored in the old builder put it
    // in label_override (its input was the prominent one) — fall back so those render
    // their text instead of the "not provided" placeholder.
    const promptText = item.scriptItem.guide_text || item.scriptItem.label_override || "";

    // FK fields (deal category) get their choices from /form-data rather than a
    // static list. Fetched unconditionally-but-disabled: hooks can't sit behind
    // the `kind` early-returns below.
    const { data: formDataRows } = useFormData<any>(meta?.formDataType ?? "categories", {
        paginate: false,
        enabled: !!meta?.formDataType,
    });
    const fkOptions = useMemo(
        () =>
            (formDataRows ?? []).map((r: any) => ({
                value: String(r.id),
                label: String(r.category_name ?? r.name ?? r.type ?? r.label ?? r.id),
            })),
        [formDataRows],
    );

    const saveAnswer = () => {
        if (!answer.trim()) return;
        createNote({ title: label, text: answer }, () => {
            setAnswer("");
            onAnswered?.();
        });
    };

    if (item.kind === "instruction") {
        return (
            <InstructionCard text={promptText || "No instruction text provided."} />
        );
    }

    if (item.kind === "question") {
        return (
            <AnalysisFieldRow number={number} answered={answered} label={promptText || "No question text provided."}>
                <div>
                    <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder={"Type the lead's answer here…"}
                        rows={3}
                        className="w-full resize-y rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none transition-colors"
                        style={{
                            border: `1px solid ${T.BORDER}`,
                            color: T.TEXT,
                            fontFamily: "inherit",
                            background: "#f8fafc",
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = "#38bdf8";
                            e.target.style.boxShadow = "0 0 0 2px #e0f2fe";
                            e.target.style.background = "#fff";
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = T.BORDER;
                            e.target.style.boxShadow = "none";
                            e.target.style.background = "#f8fafc";
                        }}
                    />
                    {answer.trim() && (
                        <div className="flex justify-end mt-1.5">
                            <button
                                type="button"
                                className="dr-btn dr-btn-primary dr-btn-sm"
                                disabled={isSaving}
                                onClick={saveAnswer}
                            >
                                {isSaving ? "Saving…" : "Save as note"}
                            </button>
                        </div>
                    )}
                </div>
            </AnalysisFieldRow>
        );
    }

    // native_field, hibarr_field, lead_field
    if (!meta) {
        return (
            <AnalysisFieldRow number={number} answered={false} label={label}>
                <p className="text-xs italic" style={{ color: T.TEXT_HINT }}>{"Field not configured."}</p>
            </AnalysisFieldRow>
        );
    }

    let currentValue: unknown = null;
    let updateType = "details";
    if (item.kind === "native_field") {
        currentValue = (deal as any)[item.scriptItem.item_key] ?? null;
        updateType = "details";
    } else if (item.kind === "hibarr_field") {
        currentValue = (deal as any).hibarrFields?.[item.scriptItem.item_key] ?? null;
        updateType = "hibarr_field";
    } else if (item.kind === "lead_field") {
        currentValue = (deal.contact as any)?.[item.scriptItem.item_key] ?? null;
        updateType = "contact";
    }

    const filled = currentValue !== null && currentValue !== undefined && currentValue !== "";

    // Booleans have no FormField equivalent; everything else renders through the
    // same always-open inputs the custom fields use.
    if (meta.fieldType === "boolean") {
        return (
            <AnalysisFieldRow number={number} answered={filled} label={label}>
                <DealSwitch
                    checked={!!currentValue}
                    label={label}
                    disabled={!canEdit}
                    onChange={() => onFieldUpdate(item.scriptItem.item_key, !currentValue, updateType)}
                />
            </AnalysisFieldRow>
        );
    }

    return (
        <FormField
            // id is only used for file uploads, which native fields never are
            field={{ id: 0, label, type: meta.fieldType, values: meta.formDataType ? fkOptions : meta.options }}
            value={currentValue}
            fieldNumber={number}
            canEdit={canEdit}
            onChange={() => {}}
            onSave={(val) => onFieldUpdate(item.scriptItem.item_key, val, updateType)}
        />
    );
}
