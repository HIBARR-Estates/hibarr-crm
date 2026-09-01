import { useEffect, useMemo, useState } from "react";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import Switch from "@/Components/Redesign/primitives/Switch";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { message } from "antd";
import {
    FIELD_TYPE_LABELS,
    FieldDraft,
    ModuleGroup,
    OPTION_VALUE_TYPES,
    SettingsCategory,
    SettingsField,
    fieldHasRule,
} from "../types";

const CREATABLE_TYPES = [
    "text",
    "textarea",
    "number",
    "select",
    "multiselect",
    "radio",
    "checkbox",
    "date",
    "datetime",
    "email",
    "url",
    "phone",
    "file",
] as const;

interface Props {
    open: boolean;
    moduleGroups: ModuleGroup[];
    categories: SettingsCategory[];
    editingField: SettingsField | null;
    defaultModuleId: number | null;
    saving: boolean;
    onClose: () => void;
    onSave: (draft: FieldDraft, original: SettingsField | null) => Promise<SettingsField | null>;
    onOpenRuleBuilder: (field: SettingsField) => void;
}

function emptyDraft(moduleId: number | null): FieldDraft {
    return {
        module: moduleId ?? "",
        label: "",
        type: "text",
        category: "",
        required: "no",
        visible: false,
        export: false,
        display_order: 0,
        values: [""],
    };
}

function draftFromField(field: SettingsField): FieldDraft {
    return {
        module: field.custom_field_group_id,
        label: field.label,
        type: field.type,
        category: field.custom_field_category_id ?? "",
        required: field.required,
        visible: field.visible,
        export: field.export,
        display_order: field.display_order,
        values: field.values.length ? [...field.values] : [""],
    };
}

export default function FieldModal({
    open,
    moduleGroups,
    categories,
    editingField,
    defaultModuleId,
    saving,
    onClose,
    onSave,
    onOpenRuleBuilder,
}: Props) {
    const { td } = useTd();
    const [draft, setDraft] = useState<FieldDraft>(() => emptyDraft(defaultModuleId));

    useEffect(() => {
        if (!open) return;
        setDraft(editingField ? draftFromField(editingField) : emptyDraft(defaultModuleId));
    }, [open, editingField, defaultModuleId]);

    const isEditing = !!editingField;
    const isRepeatable = draft.type === "repeatable";
    const isOptionType = (OPTION_VALUE_TYPES as readonly string[]).includes(draft.type);
    const typeOptions = useMemo(() => {
        const list = isRepeatable ? [...CREATABLE_TYPES, "repeatable"] : CREATABLE_TYPES;
        return list.map((type) => ({ value: type, label: FIELD_TYPE_LABELS[type] ?? type }));
    }, [isRepeatable]);

    const categoryOptions = useMemo(
        () =>
            categories
                .filter((c) => c.custom_field_group_id === draft.module)
                .map((c) => ({ value: c.id, label: c.name })),
        [categories, draft.module],
    );

    const hasRule = editingField ? fieldHasRule(editingField) : false;

    const patch = (partial: Partial<FieldDraft>) => setDraft((prev) => ({ ...prev, ...partial }));

    const handleSave = async () => {
        if (!draft.label.trim()) {
            message.error(td("Enter a field label", { source: "en" }));
            return;
        }
        if (!draft.module) {
            message.error(td("Select a module", { source: "en" }));
            return;
        }
        const saved = await onSave(draft, editingField);
        if (saved) onClose();
    };

    return (
        <Modal
            open={open}
            title={isEditing ? td("Edit field", { source: "en" }) : td("Add field", { source: "en" })}
            onClose={onClose}
            dirty={draft.label.trim().length > 0}
            footer={
                <div style={{ display: "flex", flex: "1 1 auto", alignItems: "center", justifyContent: "space-between" }}>
                    {isEditing ? (
                        <button
                            type="button"
                            onClick={() => editingField && onOpenRuleBuilder(editingField)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 7,
                                background: "none",
                                border: "none",
                                color: T.TEAL,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                padding: 0,
                            }}
                        >
                            <Icon name="target" size={15} />
                            {hasRule
                                ? td("Edit visibility rule", { source: "en" })
                                : td("Add visibility rule", { source: "en" })}
                        </button>
                    ) : (
                        <span />
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Button variant="ghost" onClick={onClose} disabled={saving}>
                            {td("Cancel", { source: "en" })}
                        </Button>
                        <Button variant="primary" onClick={handleSave} loading={saving} icon={<Icon name="check" size={15} />}>
                            {isEditing ? td("Save changes", { source: "en" }) : td("Create field", { source: "en" })}
                        </Button>
                    </div>
                </div>
            }
        >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ModalField label={td("Module", { source: "en" })}>
                    <MenuSelect
                        value={draft.module}
                        onChange={(v) => patch({ module: Number(v), category: "" })}
                        options={moduleGroups.map((g) => ({ value: g.id, label: g.name }))}
                        fullWidth
                        disabled={isEditing}
                    />
                </ModalField>
                <ModalField
                    label={
                        <>
                            {td("Label", { source: "en" })} <span style={{ color: T.RED }}>*</span>
                        </>
                    }
                >
                    <input
                        className="dr-input"
                        style={{ width: "100%", padding: "11px 12px", fontSize: 14 }}
                        value={draft.label}
                        onChange={(e) => patch({ label: e.target.value })}
                        placeholder={td("e.g. Preferred area", { source: "en" })}
                    />
                </ModalField>
                <ModalField label={td("Field type", { source: "en" })}>
                    <MenuSelect
                        value={draft.type}
                        onChange={(v) => {
                            const next = String(v);
                            const patchValues =
                                (OPTION_VALUE_TYPES as readonly string[]).includes(next) && draft.values.length === 0
                                    ? [""]
                                    : draft.values;
                            patch({ type: next, values: patchValues });
                        }}
                        options={typeOptions}
                        fullWidth
                        disabled={isRepeatable}
                    />
                </ModalField>
                <ModalField label={td("Category", { source: "en" })}>
                    <MenuSelect
                        value={draft.category}
                        onChange={(v) => patch({ category: v === "" ? "" : Number(v) })}
                        options={[{ value: "", label: td("No category", { source: "en" }) }, ...categoryOptions]}
                        fullWidth
                    />
                </ModalField>
            </div>

            {isOptionType && (
                <div style={{ marginTop: 18, padding: 16, background: T.SURFACE_2, border: `1px solid ${T.BORDER_SOFT}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.TEXT_MUTED, marginBottom: 10 }}>
                        {td("Options", { source: "en" })}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {draft.values.map((value, index) => (
                            <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input
                                    className="dr-input"
                                    style={{ padding: "10px 12px", fontSize: 14 }}
                                    value={value}
                                    onChange={(e) => {
                                        const next = [...draft.values];
                                        next[index] = e.target.value;
                                        patch({ values: next });
                                    }}
                                    placeholder={td("Option value", { source: "en" })}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = draft.values.filter((_, i) => i !== index);
                                        patch({ values: next.length ? next : [""] });
                                    }}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 38,
                                        height: 38,
                                        flexShrink: 0,
                                        borderRadius: 8,
                                        background: T.WHITE,
                                        border: `1px solid ${T.BORDER}`,
                                        color: T.TEXT_MUTED,
                                        cursor: "pointer",
                                    }}
                                >
                                    <Icon name="trash" size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => patch({ values: [...draft.values, ""] })}
                        style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.BLUE, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                        <Icon name="plus" size={15} />
                        {td("Add option", { source: "en" })}
                    </button>
                </div>
            )}

            {isRepeatable && (
                <div style={{ marginTop: 18, padding: "14px 16px", background: T.AMBER_BG, border: `1px solid ${T.AMBER_BORDER}`, borderRadius: 10, fontSize: 13, color: T.AMBER_TEXT }}>
                    {td(
                        "Repeatable fields capture a list of sub-records with their own item schema. That schema isn't editable from this screen — the fields below only change this field's label, category, required/order and visibility settings.",
                        { source: "en" },
                    )}
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18, alignItems: "start" }}>
                <div>
                    <div style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.TEXT_MUTED, marginBottom: 9 }}>
                        {td("Required", { source: "en" })}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        {(["yes", "no"] as const).map((option) => {
                            const active = draft.required === option;
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => patch({ required: option })}
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        padding: "8px 18px",
                                        borderRadius: 8,
                                        cursor: "pointer",
                                        border: `1px solid ${active ? T.BLUE : T.BORDER}`,
                                        background: active ? T.BLUE_LIGHT : T.WHITE,
                                        color: active ? T.BLUE_DARK : T.TEXT_MUTED,
                                    }}
                                >
                                    {option === "yes" ? td("Yes", { source: "en" }) : td("No", { source: "en" })}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <ModalField label={td("Display order", { source: "en" })}>
                    <input
                        type="number"
                        className="dr-input"
                        style={{ padding: "11px 12px", fontSize: 14 }}
                        value={draft.display_order}
                        onChange={(e) => patch({ display_order: Number(e.target.value) || 0 })}
                    />
                </ModalField>
            </div>

            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14, paddingTop: 16, borderTop: `1px solid ${T.BORDER_SOFT}` }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 11, cursor: "pointer" }}>
                    <Switch checked={draft.visible} onChange={() => patch({ visible: !draft.visible })} />
                    <span>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: T.TEXT }}>
                            {td("Show in table", { source: "en" })}
                        </span>
                        <span style={{ display: "block", fontSize: 12, color: T.TEXT_MUTED, marginTop: 1 }}>
                            {td("Display this field as a column in list views.", { source: "en" })}
                        </span>
                    </span>
                </label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 11, cursor: "pointer" }}>
                    <Switch checked={draft.export} onChange={() => patch({ export: !draft.export })} />
                    <span>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: T.TEXT }}>
                            {td("Include in exports", { source: "en" })}
                        </span>
                        <span style={{ display: "block", fontSize: 12, color: T.TEXT_MUTED, marginTop: 1 }}>
                            {td("Add this field as a column when records are exported.", { source: "en" })}
                        </span>
                    </span>
                </label>
            </div>
        </Modal>
    );
}
