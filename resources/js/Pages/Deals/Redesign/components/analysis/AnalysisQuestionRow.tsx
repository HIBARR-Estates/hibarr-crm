import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealNoteCreate from "../../hooks/useDealNoteCreate";
import DealEditableField from "../primitives/DealEditableField";
import DealSwitch from "../primitives/DealSwitch";
import { ANALYSIS_FIELD_META } from "../../config/analysisFieldMeta";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import type { AnalysisSectionItem } from "./types/analysisTypes";

interface Props {
    item: AnalysisSectionItem;
    canEdit: boolean;
    updatingField?: string | null;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => Promise<void>;
    onFieldChange?: (fieldId: number, value: any) => void;
}

function NumberBadge({ number, answered }: { number?: number; answered: boolean }) {
    return (
        <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 transition-all"
            style={
                answered
                    ? { backgroundColor: "#d1fae5", color: "#065f46" }
                    : { backgroundColor: T.SURFACE_2, color: T.TEXT_MUTED, border: `1.5px solid ${T.BORDER}` }
            }
        >
            {answered ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            ) : (
                number ?? "·"
            )}
        </div>
    );
}

function InstructionCard({ text }: { text: string }) {
    return (
        <div
            className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 my-3"
            style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "3px solid #f59e0b" }}
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
    canEdit,
    updatingField,
    onFieldUpdate,
    onFieldChange,
}: Props) {
    const { deal } = useDealWorkspace();
    const { td } = useTd();
    const { createNote, isSaving } = useDealNoteCreate(deal.id);
    const [answer, setAnswer] = useState("");
    const [saved, setSaved] = useState(false);

    const meta = ANALYSIS_FIELD_META[item.scriptItem.item_key];
    const label = item.scriptItem.label_override || meta?.label || item.scriptItem.item_key;

    const saveAnswer = () => {
        if (!answer.trim()) return;
        createNote({ title: label, text: answer }, () => {
            setAnswer("");
            setSaved(true);
        });
    };

    if (item.kind === "instruction") {
        return (
            <InstructionCard text={item.scriptItem.guide_text || td("No instruction text provided.")} />
        );
    }

    if (item.kind === "question") {
        return (
            <div className="flex gap-3 mb-5">
                <NumberBadge number={item.number} answered={saved} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-2 leading-snug" style={{ color: T.TEXT }}>
                        {item.scriptItem.guide_text || td("No question text provided.")}
                    </p>
                    <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder={td("Type the lead's answer here…")}
                        rows={3}
                        className="w-full resize-y rounded-lg px-3 py-2 text-sm placeholder-slate-400 focus:outline-none transition-colors"
                        style={{
                            border: `1px solid ${T.BORDER}`,
                            color: T.TEXT,
                            fontFamily: "inherit",
                            background: T.SURFACE_2,
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = "#93c5fd";
                            e.target.style.boxShadow = `0 0 0 2px ${T.BLUE_LIGHT}`;
                            e.target.style.background = "#fff";
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = T.BORDER;
                            e.target.style.boxShadow = "none";
                            e.target.style.background = T.SURFACE_2;
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
                                {isSaving ? td("Saving…") : td("Save as note")}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // native_field, hibarr_field, lead_field
    if (!meta) {
        return (
            <div className="flex gap-3 mb-5">
                <NumberBadge number={item.number} answered={false} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: T.TEXT_MUTED }}>
                        {td(label)}
                    </p>
                    <p className="text-xs italic" style={{ color: T.TEXT_HINT }}>{td("Field not configured.")}</p>
                </div>
            </div>
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

    return (
        <div className="flex gap-3 mb-5">
            <NumberBadge number={item.number} answered={filled} />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: T.TEXT_MUTED }}>
                    {td(label)}
                </p>
                {item.kind === "hibarr_field" && meta.fieldType === "boolean" ? (
                    <DealSwitch
                        checked={!!currentValue}
                        label={td(label)}
                        disabled={!canEdit}
                        loading={updatingField === item.scriptItem.item_key}
                        onChange={() =>
                            onFieldUpdate(item.scriptItem.item_key, !currentValue, updateType)
                        }
                    />
                ) : (
                    <DealEditableField
                        value={currentValue}
                        fieldName={item.scriptItem.item_key}
                        fieldType={meta.fieldType as any}
                        disabled={!canEdit}
                        loading={updatingField === item.scriptItem.item_key}
                        onSave={(val: unknown) => onFieldUpdate(item.scriptItem.item_key, val, updateType)}
                    />
                )}
            </div>
        </div>
    );
}
