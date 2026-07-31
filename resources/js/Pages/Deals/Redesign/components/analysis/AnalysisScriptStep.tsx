import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealNoteCreate from "../../hooks/useDealNoteCreate";
import DealEditableField from "../primitives/DealEditableField";
import DealSwitch from "../primitives/DealSwitch";
import { ANALYSIS_FIELD_META } from "../../config/analysisFieldMeta";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import AnalysisCustomFieldForm from "./AnalysisCustomFieldForm";

export interface AnalysisScriptItem {
    id: number;
    type:
        | "custom_field_category"
        | "native_field"
        | "hibarr_field"
        | "lead_field"
        | "question"
        | "instruction";
    item_key: string;
    label_override?: string | null;
    guide_text?: string | null;
    position: number;
}

interface Props {
    item: AnalysisScriptItem;
    fields: any[];
    canEdit: boolean;
    updatingField?: string | null;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => Promise<void>;
    onFieldChange?: (fieldId: number, value: any) => void;
}

export default function AnalysisScriptStep({
    item,
    fields,
    canEdit,
    updatingField,
    onFieldUpdate,
    onFieldChange,
}: Props) {
    const { td } = useTd();
    const { deal } = useDealWorkspace();
    const [questionAnswer, setQuestionAnswer] = useState("");
    const { createNote, isSaving } = useDealNoteCreate(deal.id);

    const meta = ANALYSIS_FIELD_META[item.item_key];
    const label = item.label_override || meta?.label || item.item_key;

    const saveAnswer = () => {
        if (!questionAnswer.trim()) return;
        createNote(
            { title: label, text: questionAnswer },
            () => setQuestionAnswer(""),
        );
    };

    return (
        <div style={{ padding: "36px 48px", maxWidth: 760, margin: "0 auto" }}>
            {/* Step title */}
            <h3
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: T.NAVY,
                    marginBottom: 6,
                    lineHeight: 1.3,
                }}
            >
                {td(label)}
            </h3>

            {/* ── Instruction type — full-width styled block, no input ── */}
            {item.type === "instruction" && (
                <div
                    style={{
                        marginTop: 20,
                        background: `${T.NAVY}08`,
                        border: `1.5px solid ${T.NAVY}20`,
                        borderLeft: `4px solid ${T.NAVY}`,
                        borderRadius: 10,
                        padding: "16px 20px",
                    }}
                >
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            color: T.NAVY,
                            marginBottom: 8,
                            opacity: 0.7,
                        }}
                    >
                        {td("Instruction")}
                    </div>
                    <p
                        style={{
                            fontSize: 15,
                            color: T.TEXT,
                            lineHeight: 1.65,
                            whiteSpace: "pre-wrap",
                            margin: 0,
                        }}
                    >
                        {item.guide_text || td("No instruction text provided.")}
                    </p>
                </div>
            )}

            {/* ── Question type — prompt card + answer textarea ── */}
            {item.type === "question" && (
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Question card */}
                    <div
                        className="analysis-guide-text"
                        style={{ fontSize: 16, fontStyle: "normal", fontWeight: 500 }}
                    >
                        <span style={{ fontSize: 18, marginRight: 8 }}>?</span>
                        {item.guide_text || td("No question text provided.")}
                    </div>

                    {/* Answer area */}
                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: T.TEXT_MUTED,
                                marginBottom: 8,
                            }}
                        >
                            {td("Lead's response")}
                        </label>
                        <textarea
                            value={questionAnswer}
                            onChange={(e) => setQuestionAnswer(e.target.value)}
                            placeholder={td("Type the lead's answer here…")}
                            rows={4}
                            style={{
                                width: "100%",
                                resize: "vertical",
                                borderRadius: 8,
                                border: `1px solid ${T.BORDER}`,
                                padding: "10px 12px",
                                fontSize: 14,
                                color: T.TEXT,
                                fontFamily: "inherit",
                                outline: "none",
                                background: T.SURFACE_2,
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = T.BLUE_MID;
                                e.target.style.boxShadow = `0 0 0 2px ${T.BLUE_LIGHT}`;
                                e.target.style.background = "#fff";
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = T.BORDER;
                                e.target.style.boxShadow = "none";
                                e.target.style.background = T.SURFACE_2;
                            }}
                        />
                        {questionAnswer.trim() && (
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
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
            )}

            {/* ── Field-based types — guide text callout + fields ── */}
            {(item.type === "custom_field_category" ||
                item.type === "native_field" ||
                item.type === "hibarr_field" ||
                item.type === "lead_field") && (
                <>
                    {item.guide_text && (
                        <div className="analysis-guide-text" style={{ marginTop: 16 }}>
                            {item.guide_text}
                        </div>
                    )}

                    <div style={{ marginTop: item.guide_text ? 0 : 20 }}>
                        {item.type === "custom_field_category" && (
                            <AnalysisCustomFieldForm
                                fields={fields}
                                categoryId={parseInt(item.item_key, 10)}
                                values={deal.custom_fields_data || {}}
                                canEdit={canEdit}
                                updatingField={updatingField}
                                onSave={(fieldId, value) =>
                                    onFieldUpdate(`field_${fieldId}`, value, "custom_field")
                                }
                                onChange={onFieldChange}
                            />
                        )}

                        {item.type === "native_field" && meta && (
                            <DealEditableField
                                value={(deal as any)[item.item_key] ?? null}
                                fieldName={item.item_key}
                                fieldType={meta.fieldType as any}
                                disabled={!canEdit}
                                loading={updatingField === item.item_key}
                                onSave={(val: unknown) =>
                                    onFieldUpdate(item.item_key, val, "details")
                                }
                            />
                        )}

                        {item.type === "hibarr_field" && meta && (
                            meta.fieldType === "boolean" ? (
                                <DealSwitch
                                    checked={!!(deal as any).hibarrFields?.[item.item_key]}
                                    label={td(label)}
                                    disabled={!canEdit}
                                    loading={updatingField === item.item_key}
                                    onChange={() =>
                                        onFieldUpdate(
                                            item.item_key,
                                            !(deal as any).hibarrFields?.[item.item_key],
                                            "hibarr_field",
                                        )
                                    }
                                />
                            ) : (
                                <DealEditableField
                                    value={(deal as any).hibarrFields?.[item.item_key] ?? null}
                                    fieldName={item.item_key}
                                    fieldType={meta.fieldType as any}
                                    disabled={!canEdit}
                                    loading={updatingField === item.item_key}
                                    onSave={(val: unknown) =>
                                        onFieldUpdate(item.item_key, val, "hibarr_field")
                                    }
                                />
                            )
                        )}

                        {item.type === "lead_field" && meta && (
                            <DealEditableField
                                value={(deal.contact as any)?.[item.item_key] ?? null}
                                fieldName={item.item_key}
                                fieldType={meta.fieldType as any}
                                disabled={!canEdit}
                                loading={updatingField === item.item_key}
                                onSave={(val: unknown) =>
                                    onFieldUpdate(item.item_key, val, "contact")
                                }
                            />
                        )}

                        {!meta && item.type !== "custom_field_category" && (
                            <p className="text-[13px] italic" style={{ color: T.TEXT_HINT }}>
                                {td("Field not configured.")}
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
