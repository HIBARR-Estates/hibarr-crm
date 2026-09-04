import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import CustomFieldRuleBuilder from "@/Components/CustomFieldRuleBuilder";
import { ShowRuleSet } from "@/Types";
import { normalizeRuleSet, toRuleBuilderField } from "../adapters/ruleSummary";
import { SettingsField } from "../types";

interface Props {
    open: boolean;
    /** Fields eligible as the rule's target — same module only, one per row. */
    availableFields: SettingsField[];
    /** Pre-selected field (opened from a field row's "Edit visibility rule" link). Null = pick from the Visibility tab's "Add rule". */
    initialFieldId: number | null;
    onClose: () => void;
    /** Called after a successful save so the caller can patch its local field list's show_rule_set. */
    onSaved: (fieldId: number, ruleSet: ShowRuleSet) => void;
}

export default function VisibilityRuleModal({ open, availableFields, initialFieldId, onClose, onSaved }: Props) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [fieldId, setFieldId] = useState<number | null>(initialFieldId);
    const [ruleSet, setRuleSet] = useState<ShowRuleSet | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFieldId(initialFieldId);
        setRuleSet(null);
    }, [open, initialFieldId]);

    useEffect(() => {
        if (!open || !fieldId) return;
        let cancelled = false;
        setLoading(true);
        axios
            .get(route("custom-fields.rule-set", fieldId), { headers: { Accept: "application/json" } })
            .then((res) => {
                if (!cancelled) setRuleSet(normalizeRuleSet(res.data));
            })
            .catch(() => {
                if (!cancelled) setRuleSet(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, fieldId]);

    const selectedField = useMemo(
        () => availableFields.find((f) => f.id === fieldId) ?? null,
        [availableFields, fieldId],
    );

    const fieldOptions = useMemo(
        () => availableFields.map((f) => ({ value: f.id, label: `${f.label} · ${f.module}` })),
        [availableFields],
    );

    const referenceFields = useMemo(
        () =>
            selectedField
                ? availableFields.filter((f) => f.module === selectedField.module).map(toRuleBuilderField)
                : [],
        [availableFields, selectedField],
    );

    const handleSave = async (payload: Partial<ShowRuleSet>) => {
        if (!fieldId) return;
        setSaving(true);
        try {
            const res = await axios.post(
                route("custom-fields.save-rule-set", fieldId),
                { rule_set: payload },
                { headers: { Accept: "application/json" } },
            );
            if (!res.data?.rule_set) {
                throw new Error(res.data?.message || t("messages.somethingWentWrong"));
            }
            onSaved(fieldId, res.data.rule_set as ShowRuleSet);
            onClose();
        } catch (error: any) {
            // Single place this error is surfaced to the user — see the
            // matching note in CustomFieldRuleBuilder's catch, which
            // deliberately doesn't show a second, generic toast on top.
            message.error(error?.response?.data?.message || error?.message || t("messages.somethingWentWrong"));
            throw error;
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            title={
                selectedField
                    ? `${td("Visibility rule", { source: "en" })} · ${selectedField.label}`
                    : td("Add visibility rule", { source: "en" })
            }
            onClose={onClose}
            maxWidth={640}
        >
            {!fieldId || !selectedField ? (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5b6472", marginBottom: 7 }}>
                        {td("Show this field", { source: "en" })}
                    </div>
                    <MenuSelect
                        value={fieldId ?? ""}
                        onChange={(v) => setFieldId(Number(v))}
                        options={fieldOptions}
                        placeholder={td("Select a field…", { source: "en" })}
                        fullWidth
                        searchable
                    />
                </div>
            ) : loading ? (
                <div style={{ padding: 20, textAlign: "center", color: "#5b6472", fontSize: 13 }}>
                    {td("Loading…", { source: "en" })}
                </div>
            ) : (
                <CustomFieldRuleBuilder
                    field={toRuleBuilderField(selectedField)}
                    availableFields={referenceFields}
                    ruleSet={ruleSet}
                    onSave={handleSave}
                    onCancel={onClose}
                    loading={saving}
                />
            )}
        </Modal>
    );
}
