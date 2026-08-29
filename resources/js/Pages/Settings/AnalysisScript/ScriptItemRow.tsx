import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Badge from "@/Components/Redesign/primitives/Badge";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import DragHandle from "./DragHandle";
import type { BuilderRow, ScriptItemType } from "./types";

type Variant = "blue" | "green" | "gray" | "navy" | "amber" | "red" | "teal";

const BADGE: Partial<Record<ScriptItemType, { label: string; variant: Variant }>> = {
    native_field: { label: "Deal", variant: "navy" },
    hibarr_field: { label: "HIBARR", variant: "blue" },
    lead_field: { label: "Lead", variant: "amber" },
    deal_custom_field: { label: "Deal field", variant: "navy" },
    lead_custom_field: { label: "Lead field", variant: "amber" },
    question: { label: "Question", variant: "teal" },
    instruction: { label: "Instruction", variant: "green" },
};

interface Props {
    row: BuilderRow;
    sectionKey: string;
    onChange: (patch: Partial<BuilderRow>) => void;
    onRemove: () => void;
}

export default function ScriptItemRow({ row, sectionKey, onChange, onRemove }: Props) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `row:${row.key}`,
        data: { kind: "row", rowKey: row.key, sectionKey },
    });

    const { td } = useTd();
    const isPrompt = row.type === "question" || row.type === "instruction";
    const [notesOpen, setNotesOpen] = useState(Boolean(row.guide_text) && !isPrompt);
    const badge = BADGE[row.type];

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: 10,
                background: T.WHITE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 8,
                opacity: isDragging ? 0.4 : 1,
            }}
        >
            <DragHandle attributes={attributes} listeners={listeners} />

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                    {!isPrompt && (
                        <span style={{ fontSize: 15, fontWeight: 600, color: T.TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.displayLabel}
                        </span>
                    )}
                    {row.contextLabel && (
                        <span style={{ fontSize: 13, color: T.TEXT_HINT, flexShrink: 0 }}>
                            {row.contextLabel}
                        </span>
                    )}
                    {/* Instructions are read out, not answered — nothing to require. */}
                    {row.type !== "instruction" && (
                        <label
                            title={td(
                                "Must be answered, or explicitly marked as having no answer, before the analysis can be completed",
                                { source: "en" },
                            )}
                            style={{
                                marginLeft: "auto",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 13,
                                fontWeight: 600,
                                color: row.is_required ? T.TEXT : T.TEXT_MUTED,
                                cursor: "pointer",
                                flexShrink: 0,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={row.is_required}
                                onChange={(e) => onChange({ is_required: e.target.checked })}
                                style={{ cursor: "pointer" }}
                            />
                            {td("Required", { source: "en" })}
                        </label>
                    )}
                </div>

                {isPrompt ? (
                    /* One field: the question/instruction text itself. Stored in
                       guide_text, which is what the analysis modal renders. */
                    <textarea
                        className="dr-input"
                        rows={2}
                        placeholder={
                            row.type === "question"
                                ? "Enter the question to ask the lead…"
                                : "Enter the instruction or talking point…"
                        }
                        value={row.guide_text ?? ""}
                        onChange={(e) => onChange({ guide_text: e.target.value || null })}
                        style={{ fontSize: 15, resize: "vertical" }}
                    />
                ) : (
                    <>
                        <input
                            className="dr-input"
                            placeholder="Label (leave blank for default)"
                            value={row.label_override ?? ""}
                            onChange={(e) => onChange({ label_override: e.target.value || null })}
                            style={{ fontSize: 15 }}
                        />
                        {notesOpen ? (
                            <textarea
                                className="dr-input"
                                rows={2}
                                placeholder="Agent talking points for this step…"
                                value={row.guide_text ?? ""}
                                onChange={(e) => onChange({ guide_text: e.target.value || null })}
                                style={{ fontSize: 15, resize: "vertical", marginTop: 6 }}
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => setNotesOpen(true)}
                                style={{
                                    fontSize: 13,
                                    color: T.TEXT_MUTED,
                                    background: "none",
                                    border: "none",
                                    padding: "4px 0 0",
                                    cursor: "pointer",
                                }}
                            >
                                ▼ Add talking points
                            </button>
                        )}
                    </>
                )}
            </div>

            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${row.displayLabel}`}
                style={{ color: T.TEXT_HINT, background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.RED)}
                onMouseLeave={(e) => (e.currentTarget.style.color = T.TEXT_HINT)}
            >
                <Icon name="trash" size={16} />
            </button>
        </div>
    );
}
