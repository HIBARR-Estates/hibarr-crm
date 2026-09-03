import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import Button from "@/Components/Redesign/primitives/Button";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { normalizeRuleSet, ruleSummary } from "../adapters/ruleSummary";
import { fieldHasRule, SettingsField } from "../types";

interface Props {
    open: boolean;
    /** The field whose rule is being copied. */
    sourceField: SettingsField | null;
    /** All fields on the page — filtered down to the source field's module. */
    availableFields: SettingsField[];
    onClose: () => void;
    /** Called once per field the rule was successfully applied to, with that field's full fresh snapshot. */
    onDuplicated: (field: SettingsField) => void;
}

/** Builds the same `rule_set` payload shape CustomFieldRuleBuilder's handleSave sends. */
function buildDuplicatePayload(sourceField: SettingsField) {
    const normalized = normalizeRuleSet(sourceField.show_rule_set);
    return {
        default_visibility: normalized?.default_visibility ?? true,
        enabled: normalized?.enabled ?? false,
        group: {
            group_operator: normalized?.group?.group_operator ?? "AND",
            criteria: (normalized?.group?.criteria ?? []).map((c) => ({
                reference_field_id: c.reference_field_id,
                operator: c.operator,
                reference_value: c.reference_value,
                negate: c.negate,
            })),
        },
    };
}

export default function DuplicateRuleModal({ open, sourceField, availableFields, onClose, onDuplicated }: Props) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSelectedIds([]);
    }, [open, sourceField?.id]);

    // Rule criteria reference other fields by id within the same module (see
    // VisibilityRuleModal's referenceFields) — applying this rule to a field
    // in a different module would carry over reference_field_ids that don't
    // belong there, so the target list stays scoped the same way.
    const targetFields = useMemo(
        () =>
            sourceField
                ? availableFields.filter((f) => f.module === sourceField.module && f.id !== sourceField.id)
                : [],
        [availableFields, sourceField],
    );

    const toggle = (id: number) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
    };

    const handleDuplicate = async () => {
        if (!sourceField || selectedIds.length === 0) return;
        setSaving(true);
        const payload = buildDuplicatePayload(sourceField);
        const results = await Promise.allSettled(
            selectedIds.map((id) =>
                axios
                    .post(route("custom-fields.save-rule-set", id), { rule_set: payload }, { headers: { Accept: "application/json" } })
                    .then((res) => {
                        if (!res.data?.field) throw new Error(res.data?.message || t("messages.somethingWentWrong"));
                        return res.data.field as SettingsField;
                    }),
            ),
        );
        setSaving(false);

        const succeeded = results.filter((r): r is PromiseFulfilledResult<SettingsField> => r.status === "fulfilled");
        const failedCount = results.length - succeeded.length;

        succeeded.forEach((r) => onDuplicated(r.value));

        if (succeeded.length > 0) {
            message.success(
                td(`Rule duplicated to ${succeeded.length} field${succeeded.length === 1 ? "" : "s"}`, { source: "en" }),
            );
        }
        if (failedCount > 0) {
            message.error(
                td(`Couldn't duplicate the rule to ${failedCount} field${failedCount === 1 ? "" : "s"}`, { source: "en" }),
            );
        }
        if (failedCount === 0) onClose();
    };

    return (
        <Modal
            open={open}
            title={td("Duplicate visibility rule", { source: "en" })}
            subtitle={sourceField ? `${sourceField.label} · ${sourceField.module}` : undefined}
            onClose={onClose}
            maxWidth={480}
            footer={
                <>
                    <Button onClick={onClose} disabled={saving}>
                        {td("Cancel", { source: "en" })}
                    </Button>
                    <Button variant="primary" onClick={handleDuplicate} loading={saving} disabled={selectedIds.length === 0}>
                        {td(`Duplicate to ${selectedIds.length} field${selectedIds.length === 1 ? "" : "s"}`, { source: "en" })}
                    </Button>
                </>
            }
        >
            {sourceField && (
                <div style={{ fontSize: 13, color: T.TEXT_MUTED, marginBottom: 14 }}>
                    {td("Shown when", { source: "en" })} {ruleSummary(sourceField)}
                </div>
            )}
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.TEXT_MUTED, marginBottom: 7 }}>
                {td("Apply to", { source: "en" })}
            </div>
            {targetFields.length === 0 ? (
                <div style={{ fontSize: 13, color: T.TEXT_HINT, fontStyle: "italic", padding: "8px 0" }}>
                    {td("No other fields in this module to apply it to.", { source: "en" })}
                </div>
            ) : (
                <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${T.BORDER}`, borderRadius: 8 }}>
                    {targetFields.map((f) => {
                        const checked = selectedIds.includes(f.id);
                        const overwrites = fieldHasRule(f);
                        return (
                            <label
                                key={f.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "9px 12px",
                                    borderBottom: `1px solid ${T.BORDER}`,
                                    cursor: "pointer",
                                }}
                            >
                                <input type="checkbox" checked={checked} onChange={() => toggle(f.id)} />
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.TEXT }}>{f.label}</span>
                                    {overwrites && (
                                        <span style={{ display: "block", fontSize: 11, color: T.TEXT_HINT }}>
                                            {td("Has a rule already — will be overwritten", { source: "en" })}
                                        </span>
                                    )}
                                </span>
                            </label>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}
