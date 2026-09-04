import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import ToggleField from "@/Components/Redesign/primitives/ToggleField";
import ChipToggle from "@/Components/Redesign/primitives/ChipToggle";
import SectionLabel from "@/Components/Redesign/primitives/SectionLabel";
import SettingsPanel from "@/Components/Redesign/primitives/SettingsPanel";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { message } from "antd";
import usePipelineOptions from "@/lib/usePipelineOptions";
import {
    FIELD_TYPE_LABELS,
    FieldDraft,
    ModuleGroup,
    OPTION_VALUE_TYPES,
    SettingsCategory,
    SettingsField,
    fieldHasRule,
} from "../types";
import { buildPipelineRuleSetPayload, extractPipelineIds, isSimplePipelineRule } from "../adapters/ruleSummary";

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
    /** Replaces the field in the parent's local state with its full fresh snapshot after the simplified pipeline picker saves — this is Index.tsx's handleRuleSaved. */
    onRuleSetSaved: (field: SettingsField) => void;
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
        show_in_lead: false,
        show_in_deal: true,
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
        show_in_lead: field.show_in_lead,
        show_in_deal: field.show_in_deal,
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
    onRuleSetSaved,
}: Props) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [draft, setDraft] = useState<FieldDraft>(() => emptyDraft(defaultModuleId));
    // Only meaningful for a Lead-group FILE field whose current rule (if any)
    // is exactly the shape this picker manages — see isSimplePipelineRule.
    const [pipelineIds, setPipelineIds] = useState<number[]>([]);
    const [savingPipelines, setSavingPipelines] = useState(false);
    const { pipelines } = usePipelineOptions();

    useEffect(() => {
        if (!open) return;
        setDraft(editingField ? draftFromField(editingField) : emptyDraft(defaultModuleId));
        setPipelineIds(editingField ? extractPipelineIds(editingField.show_rule_set) : []);
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

    // The simplified picker only takes over a Lead FILE field, and only when
    // its current rule (if any) is a rule that picker itself could have
    // produced — a hand-built rule using another source, several groups, OR
    // logic, negation, or a hide action keeps the generic "Edit visibility
    // rule" link instead, so saving here can never silently discard it.
    const moduleName = moduleGroups.find((g) => g.id === draft.module)?.name;
    const isLeadFileField = draft.type === "file" && moduleName === "Lead";
    const isDealFileField = draft.type === "file" && moduleName === "Deal";
    const showPipelinePicker =
        isLeadFileField &&
        draft.show_in_deal &&
        (!editingField || isSimplePipelineRule(editingField.show_rule_set));

    const patch = (partial: Partial<FieldDraft>) => setDraft((prev) => ({ ...prev, ...partial }));

    const togglePipeline = (id: number) => {
        setPipelineIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    };

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
        if (!saved) return;

        if (showPipelinePicker) {
            const currentIds = extractPipelineIds(editingField?.show_rule_set);
            const changed =
                currentIds.length !== pipelineIds.length ||
                !currentIds.every((id) => pipelineIds.includes(id));

            if (changed) {
                setSavingPipelines(true);
                try {
                    const res = await axios.post(
                        route("custom-fields.save-rule-set", saved.id),
                        { rule_set: buildPipelineRuleSetPayload(pipelineIds) },
                        { headers: { Accept: "application/json" } },
                    );
                    if (res.data?.field) {
                        onRuleSetSaved(res.data.field);
                    } else {
                        message.error(res.data?.message || t("messages.somethingWentWrong"));
                        return;
                    }
                } catch (error: any) {
                    message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
                    return;
                } finally {
                    setSavingPipelines(false);
                }
            }
        }

        onClose();
    };

    return (
        <Modal
            open={open}
            title={isEditing ? td("Edit field", { source: "en" }) : td("Add field", { source: "en" })}
            onClose={onClose}
            dirty={draft.label.trim().length > 0}
            footer={
                <div style={{ display: "flex", flex: "1 1 auto", alignItems: "center", justifyContent: "space-between" }}>
                    {isEditing && !showPipelinePicker ? (
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
                        <Button variant="ghost" onClick={onClose} disabled={saving || savingPipelines}>
                            {td("Cancel", { source: "en" })}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            loading={saving || savingPipelines}
                            icon={<Icon name="check" size={15} />}
                        >
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
                <SettingsPanel>
                    <SectionLabel>{td("Options", { source: "en" })}</SectionLabel>
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
                </SettingsPanel>
            )}

            {isLeadFileField && (
                <SettingsPanel stack>
                    <ToggleField
                        checked={draft.show_in_deal}
                        onChange={() => patch({ show_in_deal: !draft.show_in_deal })}
                        title={td("Show in Deal", { source: "en" })}
                        description={td("Cross-populate this lead field onto a matching deal's own Files tab too, not just the lead's.", { source: "en" })}
                    />

                    {showPipelinePicker && (
                        <div style={{ paddingTop: 14, borderTop: `1px solid ${T.BORDER_SOFT}` }}>
                            <SectionLabel style={{ marginBottom: 4 }}>
                                {td("Show for pipeline(s)", { source: "en" })}
                            </SectionLabel>
                            <p style={{ margin: "0 0 10px", fontSize: 12, color: T.TEXT_MUTED }}>
                                {td(
                                    "One slot per matching deal — on the deal itself, and once per such deal on the lead. Leave empty to cross-populate onto every deal on this lead.",
                                    { source: "en" },
                                )}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {pipelines.length === 0 ? (
                                    <span style={{ fontSize: 13, color: T.TEXT_MUTED, fontStyle: "italic" }}>
                                        {td("No pipelines found.", { source: "en" })}
                                    </span>
                                ) : (
                                    pipelines.map((pipeline) => (
                                        <ChipToggle
                                            key={pipeline.id}
                                            shape="pill"
                                            active={pipelineIds.includes(pipeline.id)}
                                            onClick={() => togglePipeline(pipeline.id)}
                                        >
                                            {pipeline.name}
                                        </ChipToggle>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </SettingsPanel>
            )}

            {isDealFileField && (
                <SettingsPanel>
                    <ToggleField
                        checked={draft.show_in_lead}
                        onChange={() => patch({ show_in_lead: !draft.show_in_lead })}
                        title={td("Show in Lead", { source: "en" })}
                        description={td("Cross-populate this deal field onto its lead's Files tab too, grouped under that deal, not just the deal's own tab.", { source: "en" })}
                    />
                </SettingsPanel>
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
                    <SectionLabel style={{ marginBottom: 9 }}>
                        {td("Required", { source: "en" })}
                    </SectionLabel>
                    <div style={{ display: "flex", gap: 8 }}>
                        {(["yes", "no"] as const).map((option) => (
                            <ChipToggle
                                key={option}
                                active={draft.required === option}
                                onClick={() => patch({ required: option })}
                            >
                                {option === "yes" ? td("Yes", { source: "en" }) : td("No", { source: "en" })}
                            </ChipToggle>
                        ))}
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
                <ToggleField
                    checked={draft.visible}
                    onChange={() => patch({ visible: !draft.visible })}
                    title={td("Show in table", { source: "en" })}
                    description={td("Display this field as a column in list views.", { source: "en" })}
                />
                <ToggleField
                    checked={draft.export}
                    onChange={() => patch({ export: !draft.export })}
                    title={td("Include in exports", { source: "en" })}
                    description={td("Add this field as a column when records are exported.", { source: "en" })}
                />
            </div>
        </Modal>
    );
}
