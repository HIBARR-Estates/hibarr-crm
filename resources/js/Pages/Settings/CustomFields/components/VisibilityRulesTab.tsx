import Icon from "@/Components/Redesign/primitives/Icon";
import Button from "@/Components/Redesign/primitives/Button";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { ruleSummary } from "../adapters/ruleSummary";
import { SettingsField, fieldHasRule } from "../types";

interface Props {
    fields: SettingsField[];
    onEdit: (field: SettingsField) => void;
    onRemove: (field: SettingsField) => void;
    onAdd: () => void;
    onDuplicate: (field: SettingsField) => void;
}

export default function VisibilityRulesTab({ fields, onEdit, onRemove, onAdd, onDuplicate }: Props) {
    const { td } = useTd();
    const rulesFields = fields.filter(fieldHasRule);

    return (
        <div style={{ padding: "20px 22px 24px" }}>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: T.TEXT_MUTED, maxWidth: 640 }}>
                {td("Visibility rules show or hide a field on the record form based on the value of another field in the same module.", { source: "en" })}
            </p>

            {rulesFields.length === 0 ? (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        padding: "48px 20px",
                        color: T.TEXT_HINT,
                        border: `1px dashed ${T.BORDER}`,
                        borderRadius: 10,
                    }}
                >
                    <div style={{ width: 44, height: 44, borderRadius: 999, background: T.TEAL_SOFT, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                        <Icon name="target" size={20} color={T.TEAL} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.TEXT_MUTED, marginBottom: 4 }}>
                        {td("No visibility rules yet", { source: "en" })}
                    </div>
                    <div style={{ fontSize: 14, marginBottom: 16 }}>
                        {td("Conditional fields you configure will appear here.", { source: "en" })}
                    </div>
                    <Button variant="primary" onClick={onAdd} icon={<Icon name="plus" size={15} />}>
                        {td("Add visibility rule", { source: "en" })}
                    </Button>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {rulesFields.map((field) => (
                        <div
                            key={field.id}
                            style={{
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: 10,
                                padding: "16px 18px",
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 16,
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: 15, fontWeight: 600, color: T.NAVY }}>{field.label}</span>
                                    <span className="dr-pill dr-pill-navy">{field.module}</span>
                                </div>
                                <div style={{ fontSize: 14, color: T.TEXT_MUTED }}>
                                    {td("Shown when", { source: "en" })} {ruleSummary(field)}
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                <button type="button" onClick={() => onEdit(field)} className="dr-btn dr-btn-ghost dr-btn-sm">
                                    {td("Edit", { source: "en" })}
                                </button>
                                <button type="button" onClick={() => onDuplicate(field)} className="dr-btn dr-btn-ghost dr-btn-sm">
                                    {td("Duplicate", { source: "en" })}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onRemove(field)}
                                    className="dr-btn dr-btn-sm"
                                    style={{ background: T.WHITE, color: T.RED, border: `1px solid ${T.RED_MID}` }}
                                >
                                    {td("Remove", { source: "en" })}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
