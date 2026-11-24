import { ReactNode, useEffect, useMemo, useState } from "react";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import Button from "@/Components/Redesign/primitives/Button";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    DefinedField,
    MappingOptions,
    MappingReport,
    MappingTarget,
    ModuleGroup,
    SettingsField,
    typesCompatible,
} from "../types";
import useCustomFieldMapping from "../hooks/useCustomFieldMapping";

interface Props {
    open: boolean;
    sourceField: SettingsField | null;
    fields: SettingsField[];
    moduleGroups: ModuleGroup[];
    definedFields: DefinedField[];
    mapping: ReturnType<typeof useCustomFieldMapping>;
    onClose: () => void;
}

type AfterAction = "keep" | "delete_values" | "delete_field";

const LEAD_MODEL = "App\\Models\\Lead";
const DEAL_MODEL = "App\\Models\\Deal";
const OPTION_TYPES = ["select", "radio", "multiselect", "checkbox"];

function parseTarget(value: string): MappingTarget | null {
    if (value.startsWith("custom:")) return { type: "custom", id: Number(value.slice(7)) };
    if (value.startsWith("defined:")) return { type: "defined", key: value.slice(8) };
    return null;
}

const sectionLabel = {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: T.TEXT_MUTED,
    marginBottom: 7,
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "ok" }) {
    return (
        <div style={{ flex: "1 1 120px", border: `1px solid ${T.BORDER}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: tone === "warn" && value > 0 ? T.RED : T.TEXT }}>{value}</div>
            <div style={{ fontSize: 11, color: T.TEXT_MUTED }}>{label}</div>
        </div>
    );
}

/**
 * Map, migrate and delete one custom field: copy its values into another
 * custom field or a built-in lead/deal field, then optionally delete the
 * source values or the source field. Always previews (a server-side dry run)
 * before it can apply, so nothing is written blind.
 */
export default function MapFieldModal({ open, sourceField, fields, moduleGroups, definedFields, mapping, onClose }: Props) {
    const { td } = useTd();
    const [targetValue, setTargetValue] = useState("");
    const [conflict, setConflict] = useState<MappingOptions["conflict"]>("skip");
    const [addMissing, setAddMissing] = useState(false);
    const [after, setAfter] = useState<AfterAction>("keep");
    const [allowLoss, setAllowLoss] = useState(false);
    const [report, setReport] = useState<MappingReport | null>(null);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!open) return;
        setTargetValue("");
        setConflict("skip");
        setAddMissing(false);
        setAfter("keep");
        setAllowLoss(false);
        setReport(null);
        setDone(false);
    }, [open, sourceField?.id]);

    const modelOf = (module: string) => moduleGroups.find((g) => g.name === module)?.model;
    const sourceModel = sourceField ? modelOf(sourceField.module) : undefined;
    const mappable = sourceModel === LEAD_MODEL || sourceModel === DEAL_MODEL;

    const targetOptions = useMemo(() => {
        if (!sourceField || !mappable) return [];
        const custom = fields
            .filter((f) => f.id !== sourceField.id && [LEAD_MODEL, DEAL_MODEL].includes(modelOf(f.module) ?? ""))
            .filter((f) => typesCompatible(sourceField.type, f.type))
            .map((f) => ({ value: `custom:${f.id}`, label: `${f.label} · ${f.module} ${td("custom field", { source: "en" })}` }));
        const defined = typesCompatible(sourceField.type, "text")
            ? definedFields.map((f) => ({ value: `defined:${f.key}`, label: `${f.label} ${td("(built-in)", { source: "en" })}` }))
            : [];
        return [...custom, ...defined];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceField, fields, definedFields, moduleGroups, mappable]);

    const target = parseTarget(targetValue);
    const targetField = target?.type === "custom" ? fields.find((f) => f.id === target.id) : undefined;
    const targetDefined = target?.type === "defined" ? definedFields.find((f) => f.key === target.key) : undefined;
    const targetModel = targetField ? modelOf(targetField.module) : targetDefined?.model;
    const needsOptionToggle = !!targetField && OPTION_TYPES.includes(targetField.type);

    const options: MappingOptions = {
        conflict,
        add_missing_options: needsOptionToggle && addMissing,
        delete_source_values: after === "delete_values",
        delete_source_field: after === "delete_field",
        allow_loss: allowLoss,
    };

    // Any change to the request invalidates the preview that was shown for the old one.
    const resetReport = () => {
        setReport(null);
        setAllowLoss(false);
    };

    const crossHint =
        sourceModel && targetModel && sourceModel !== targetModel
            ? sourceModel === LEAD_MODEL
                ? td("Every deal of a lead receives the lead's value.", { source: "en" })
                : td("A lead takes the value of its most recent deal that has one.", { source: "en" })
            : null;

    const handlePreview = async () => {
        if (!sourceField || !target) return;
        const result = await mapping.preview(sourceField.id, target, options);
        setReport(result);
    };

    const handleApply = async () => {
        if (!sourceField || !target) return;
        const result = await mapping.apply(sourceField.id, target, options);
        if (result.ok) {
            setReport(result.report);
            setDone(true);
        } else if (result.report) {
            setReport(result.report);
        }
    };

    const notMigrated = report ? report.skipped_incompatible + report.skipped_conflict + report.no_target_record + report.superseded : 0;
    const deleting = after !== "keep";
    const applyBlocked = !report || (deleting && notMigrated > 0 && !allowLoss);

    const radio = (value: AfterAction, label: ReactNode, hint?: ReactNode) => (
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", cursor: "pointer" }}>
            <input
                type="radio"
                name="map-after"
                checked={after === value}
                onChange={() => {
                    setAfter(value);
                    resetReport();
                }}
                style={{ marginTop: 3 }}
            />
            <span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: value === "keep" ? T.TEXT : value === "delete_field" ? T.RED : T.TEXT }}>
                    {label}
                </span>
                {hint && <span style={{ display: "block", fontSize: 11, color: T.TEXT_HINT }}>{hint}</span>}
            </span>
        </label>
    );

    return (
        <Modal
            open={open}
            title={td("Map & migrate field", { source: "en" })}
            subtitle={sourceField ? `${sourceField.label} · ${sourceField.module}` : undefined}
            onClose={onClose}
            maxWidth={560}
            footer={
                done ? (
                    <Button variant="primary" onClick={onClose}>
                        {td("Done", { source: "en" })}
                    </Button>
                ) : (
                    <>
                        <Button onClick={onClose} disabled={mapping.applying}>
                            {td("Cancel", { source: "en" })}
                        </Button>
                        <Button onClick={handlePreview} loading={mapping.previewing} disabled={!target || mapping.applying}>
                            {td("Preview", { source: "en" })}
                        </Button>
                        <Button variant={deleting ? "danger" : "primary"} onClick={handleApply} loading={mapping.applying} disabled={applyBlocked}>
                            {deleting ? td("Migrate & delete", { source: "en" }) : td("Migrate", { source: "en" })}
                        </Button>
                    </>
                )
            }
        >
            {!mappable ? (
                <div style={{ fontSize: 13, color: T.TEXT_HINT, fontStyle: "italic" }}>
                    {td("Only lead and deal fields can be mapped.", { source: "en" })}
                </div>
            ) : done && report ? (
                <div style={{ fontSize: 13, color: T.TEXT }}>
                    <p style={{ marginTop: 0 }}>
                        {td(`${report.mapped} value(s) migrated.`, { source: "en" })}
                        {report.deleted_field
                            ? ` ${td("The source field was deleted.", { source: "en" })}`
                            : report.deleted_values > 0
                              ? ` ${td(`${report.deleted_values} source value(s) deleted.`, { source: "en" })}`
                              : ""}
                    </p>
                    {report.added_options.length > 0 && (
                        <p>{td("Options added to the target field:", { source: "en" })} {report.added_options.join(", ")}</p>
                    )}
                </div>
            ) : (
                <>
                    <ModalField label={td("Map into", { source: "en" })}>
                        <MenuSelect
                            value={targetValue}
                            onChange={(v) => {
                                setTargetValue(String(v));
                                setAddMissing(false);
                                resetReport();
                            }}
                            options={[{ value: "", label: td("Choose a field…", { source: "en" }) }, ...targetOptions]}
                            fullWidth
                        />
                        {crossHint && <div style={{ fontSize: 11, color: T.TEXT_HINT, marginTop: 4 }}>{crossHint}</div>}
                    </ModalField>

                    <ModalField label={td("If the target already has a value", { source: "en" })}>
                        <MenuSelect
                            value={conflict}
                            onChange={(v) => {
                                setConflict(v as MappingOptions["conflict"]);
                                resetReport();
                            }}
                            options={[
                                { value: "skip", label: td("Keep the existing value", { source: "en" }) },
                                { value: "overwrite", label: td("Overwrite with this field's value", { source: "en" }) },
                            ]}
                            fullWidth
                        />
                    </ModalField>

                    {needsOptionToggle && (
                        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 16, cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={addMissing}
                                onChange={(e) => {
                                    setAddMissing(e.target.checked);
                                    resetReport();
                                }}
                            />
                            {td("Add options the target field is missing", { source: "en" })}
                        </label>
                    )}

                    <div style={sectionLabel}>{td("After migrating", { source: "en" })}</div>
                    {radio("keep", td("Keep this field and its values", { source: "en" }))}
                    {radio("delete_values", td("Delete this field's values, keep the field", { source: "en" }))}
                    {radio("delete_field", td("Delete this field and its values", { source: "en" }), td("Cannot be undone.", { source: "en" }))}

                    {report && (
                        <div style={{ marginTop: 16 }}>
                            <div style={sectionLabel}>{td("Preview — nothing has been changed yet", { source: "en" })}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                <Stat label={td("Values found", { source: "en" })} value={report.source_total} />
                                <Stat label={td("Will be migrated", { source: "en" })} value={report.mapped} />
                                <Stat label={td("Already the same", { source: "en" })} value={report.unchanged} />
                                <Stat label={td("Kept (target has a value)", { source: "en" })} value={report.skipped_conflict} tone="warn" />
                                <Stat label={td("Incompatible", { source: "en" })} value={report.skipped_incompatible} tone="warn" />
                                <Stat label={td("No record to write to", { source: "en" })} value={report.no_target_record} tone="warn" />
                                {report.superseded > 0 && <Stat label={td("Older deals (newest wins)", { source: "en" })} value={report.superseded} tone="warn" />}
                            </div>

                            {report.added_options.length > 0 && (
                                <div style={{ fontSize: 12, color: T.TEXT_MUTED, marginTop: 8 }}>
                                    {td("Options that will be added:", { source: "en" })} {report.added_options.join(", ")}
                                </div>
                            )}

                            {report.incompatible_samples.length > 0 && (
                                <div style={{ marginTop: 10, fontSize: 12, color: T.TEXT_MUTED }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{td("Examples that can't be migrated", { source: "en" })}</div>
                                    {report.incompatible_samples.map((s) => (
                                        <div key={`${s.record_id}-${s.value}`} style={{ padding: "2px 0" }}>
                                            #{s.record_id} · “{s.value}” — {s.reason}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {deleting && notMigrated > 0 && (
                                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, fontSize: 13, color: T.RED, cursor: "pointer" }}>
                                    <input type="checkbox" checked={allowLoss} onChange={(e) => setAllowLoss(e.target.checked)} style={{ marginTop: 3 }} />
                                    {td(`${notMigrated} value(s) won't be migrated and will be lost when the source is deleted. Delete anyway.`, { source: "en" })}
                                </label>
                            )}
                        </div>
                    )}
                </>
            )}
        </Modal>
    );
}
