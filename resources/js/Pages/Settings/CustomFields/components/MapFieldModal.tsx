import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import Button from "@/Components/Redesign/primitives/Button";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import {
    AssessmentOptions,
    AssessmentTargetOptions,
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
    assessmentOptions: AssessmentOptions | null;
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
        <div style={{ border: `1px solid ${T.BORDER}`, borderRadius: 8, padding: "8px 10px" }}>
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
export default function MapFieldModal({ open, sourceField, fields, moduleGroups, definedFields, assessmentOptions, mapping, onClose }: Props) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [targetValue, setTargetValue] = useState("");
    const [conflict, setConflict] = useState<MappingOptions["conflict"]>("skip");
    const [addMissing, setAddMissing] = useState(false);
    const [after, setAfter] = useState<AfterAction>("keep");
    const [allowLoss, setAllowLoss] = useState(false);
    const [report, setReport] = useState<MappingReport | null>(null);
    const [done, setDone] = useState(false);
    const [assessment, setAssessment] = useState<AssessmentTargetOptions | null>(null);

    useEffect(() => {
        if (!open) return;
        previewSeq.current += 1;
        setTargetValue("");
        setConflict("skip");
        setAddMissing(false);
        setAfter("keep");
        setAllowLoss(false);
        setReport(null);
        setDone(false);
        setAssessment(null);
    }, [open, sourceField?.id]);

    const modelOf = (module: string) => moduleGroups.find((g) => g.name === module)?.model;
    const sourceModel = sourceField ? modelOf(sourceField.module) : undefined;
    const mappable = sourceModel === LEAD_MODEL || sourceModel === DEAL_MODEL;

    const targetOptions = useMemo(() => {
        if (!sourceField || !mappable) return [];
        const custom = fields
            .filter((f) => f.id !== sourceField.id && [LEAD_MODEL, DEAL_MODEL].includes(modelOf(f.module) ?? ""))
            .filter((f) => typesCompatible(sourceField.type, f.type))
            .map((f) => ({ value: `custom:${f.id}`, label: `${f.label} · ${f.module} ${t("pages.settings.custom_fields_mapping.suffix_custom_field")}` }));
        const defined = typesCompatible(sourceField.type, "text")
            ? definedFields.map((f) => ({
                  value: `defined:${f.key}`,
                  label: `${f.label} ${t(f.kind === "amount" ? "pages.settings.custom_fields_mapping.suffix_financial" : "pages.settings.custom_fields_mapping.suffix_built_in")}`,
              }))
            : [];
        return [...custom, ...defined];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceField, fields, definedFields, moduleGroups, mappable]);

    const target = parseTarget(targetValue);
    const targetField = target?.type === "custom" ? fields.find((f) => f.id === target.id) : undefined;
    const targetDefined = target?.type === "defined" ? definedFields.find((f) => f.key === target.key) : undefined;
    const targetModel = targetField ? modelOf(targetField.module) : targetDefined?.model;
    const needsOptionToggle = !!targetField && OPTION_TYPES.includes(targetField.type);
    const isAmountTarget = targetDefined?.kind === "amount" && assessmentOptions !== null;

    const options: MappingOptions = {
        conflict,
        add_missing_options: needsOptionToggle && addMissing,
        delete_source_values: after === "delete_values",
        delete_source_field: after === "delete_field",
        allow_loss: allowLoss,
        ...(isAmountTarget && assessment ? { assessment } : {}),
    };

    // Any change to the request invalidates the preview that was shown for the old one.
    // A preview still in flight for the old request must not repopulate it.
    const previewSeq = useRef(0);
    const resetReport = () => {
        previewSeq.current += 1;
        setReport(null);
        setAllowLoss(false);
    };

    const crossHint =
        sourceModel && targetModel && sourceModel !== targetModel
            ? sourceModel === LEAD_MODEL
                ? t("pages.settings.custom_fields_mapping.cross_lead_to_deal")
                : t("pages.settings.custom_fields_mapping.cross_deal_to_lead")
            : null;

    const handlePreview = async () => {
        if (!sourceField || !target) return;
        const seq = ++previewSeq.current;
        const result = await mapping.preview(sourceField.id, target, options);
        if (seq === previewSeq.current) setReport(result);
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

    const notMigrated = report ? report.skipped_incompatible + report.skipped_locked + report.skipped_conflict + report.no_target_record + report.superseded : 0;
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
                {hint && <span style={{ display: "block", fontSize: 11, color: T.TEXT_MUTED }}>{hint}</span>}
            </span>
        </label>
    );

    return (
        <Modal
            open={open}
            title={t("pages.settings.custom_fields_mapping.title")}
            subtitle={sourceField ? `${sourceField.label} · ${sourceField.module}` : undefined}
            onClose={onClose}
            maxWidth={560}
            footer={
                done ? (
                    <Button variant="primary" onClick={onClose}>
                        {t("pages.settings.custom_fields_mapping.done")}
                    </Button>
                ) : (
                    <>
                        <Button onClick={onClose} disabled={mapping.applying}>
                            {t("pages.settings.custom_fields_mapping.cancel")}
                        </Button>
                        <Button onClick={handlePreview} loading={mapping.previewing} disabled={!target || mapping.applying}>
                            {t("pages.settings.custom_fields_mapping.preview")}
                        </Button>
                        <Button variant={deleting ? "danger" : "primary"} onClick={handleApply} loading={mapping.applying} disabled={applyBlocked}>
                            {deleting ? t("pages.settings.custom_fields_mapping.migrate_and_delete") : t("pages.settings.custom_fields_mapping.migrate")}
                        </Button>
                    </>
                )
            }
        >
            {!mappable ? (
                <div style={{ fontSize: 13, color: T.TEXT_HINT, fontStyle: "italic" }}>
                    {t("pages.settings.custom_fields_mapping.only_lead_deal")}
                </div>
            ) : done && report ? (
                <div style={{ fontSize: 13, color: T.TEXT }}>
                    <p style={{ marginTop: 0 }}>
                        {t("pages.settings.custom_fields_mapping.records_updated", { n: report.mapped })}
                        {report.deleted_field
                            ? ` ${t("pages.settings.custom_fields_mapping.source_deleted")}`
                            : report.deleted_values > 0
                              ? ` ${t("pages.settings.custom_fields_mapping.source_values_deleted", { n: report.deleted_values })}`
                              : ""}
                    </p>
                    {report.added_options.length > 0 && (
                        <p>{t("pages.settings.custom_fields_mapping.options_added")} {report.added_options.join(", ")}</p>
                    )}
                </div>
            ) : (
                <>
                    <ModalField label={t("pages.settings.custom_fields_mapping.map_into")}>
                        <MenuSelect
                            value={targetValue}
                            onChange={(v) => {
                                setTargetValue(String(v));
                                setAddMissing(false);
                                // A financial target starts from the line type's own defaults: visible and editable, never guessed.
                                const picked = parseTarget(String(v));
                                const defined = picked?.type === "defined" ? definedFields.find((f) => f.key === picked.key) : undefined;
                                setAssessment(
                                    defined?.kind === "amount" && assessmentOptions
                                        ? {
                                              currency: assessmentOptions.reporting_currency,
                                              frequency: defined.defaults?.frequency ?? "once",
                                              certainty: defined.defaults?.certainty ?? "likely",
                                          }
                                        : null,
                                );
                                resetReport();
                            }}
                            options={[{ value: "", label: t("pages.settings.custom_fields_mapping.choose_field") }, ...targetOptions]}
                            fullWidth
                        />
                        {crossHint && <div style={{ fontSize: 11, color: T.TEXT_HINT, marginTop: 4 }}>{crossHint}</div>}
                    </ModalField>

                    {isAmountTarget && assessment && assessmentOptions && (
                        <div style={{ marginBottom: 16, padding: 12, border: `1px solid ${T.BORDER}`, borderRadius: 10, background: T.SURFACE_SUBTLE }}>
                            <div style={sectionLabel}>{t("pages.settings.custom_fields_mapping.assessment_heading")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                                <ModalField label={t("pages.settings.custom_fields_mapping.assessment_currency")}>
                                    <MenuSelect
                                        value={assessment.currency}
                                        onChange={(v) => {
                                            setAssessment({ ...assessment, currency: String(v) });
                                            resetReport();
                                        }}
                                        options={assessmentOptions.currencies.map((code) => ({ value: code, label: code }))}
                                        searchable
                                        fullWidth
                                    />
                                </ModalField>
                                <ModalField label={t("pages.settings.custom_fields_mapping.assessment_frequency")}>
                                    <MenuSelect
                                        value={assessment.frequency}
                                        onChange={(v) => {
                                            setAssessment({ ...assessment, frequency: String(v) });
                                            resetReport();
                                        }}
                                        options={assessmentOptions.frequencies.map((value) => ({ value, label: t(`pages.leads.financials.frequencies.${value}`) }))}
                                        fullWidth
                                    />
                                </ModalField>
                                <ModalField label={t("pages.settings.custom_fields_mapping.assessment_certainty")}>
                                    <MenuSelect
                                        value={assessment.certainty}
                                        onChange={(v) => {
                                            setAssessment({ ...assessment, certainty: String(v) });
                                            resetReport();
                                        }}
                                        options={assessmentOptions.certainties.map((value) => ({ value, label: t(`pages.leads.financials.certainties.${value}`) }))}
                                        fullWidth
                                    />
                                </ModalField>
                            </div>
                            <div style={{ fontSize: 11, color: T.TEXT_HINT }}>{t("pages.settings.custom_fields_mapping.assessment_help")}</div>
                        </div>
                    )}

                    <ModalField label={t("pages.settings.custom_fields_mapping.conflict_label")}>
                        <MenuSelect
                            value={conflict}
                            onChange={(v) => {
                                setConflict(v as MappingOptions["conflict"]);
                                resetReport();
                            }}
                            options={[
                                { value: "skip", label: t("pages.settings.custom_fields_mapping.conflict_keep") },
                                { value: "overwrite", label: t("pages.settings.custom_fields_mapping.conflict_overwrite") },
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
                            {t("pages.settings.custom_fields_mapping.add_missing_options")}
                        </label>
                    )}

                    <div style={sectionLabel}>{t("pages.settings.custom_fields_mapping.after_label")}</div>
                    {radio("keep", t("pages.settings.custom_fields_mapping.after_keep"))}
                    {radio("delete_values", t("pages.settings.custom_fields_mapping.after_delete_values"))}
                    {radio("delete_field", t("pages.settings.custom_fields_mapping.after_delete_field"), t("pages.settings.custom_fields_mapping.cannot_be_undone"))}

                    {report && (
                        <div style={{ marginTop: 16 }}>
                            <div style={sectionLabel}>{t("pages.settings.custom_fields_mapping.preview_heading")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                                <Stat label={t("pages.settings.custom_fields_mapping.stat_source_values")} value={report.source_total} />
                                <Stat label={t("pages.settings.custom_fields_mapping.stat_records_to_update")} value={report.mapped} />
                                <Stat label={t("pages.settings.custom_fields_mapping.stat_unchanged")} value={report.unchanged} />
                                <Stat label={t("pages.settings.custom_fields_mapping.stat_kept")} value={report.skipped_conflict} tone="warn" />
                                <Stat label={t("pages.settings.custom_fields_mapping.stat_incompatible")} value={report.skipped_incompatible} tone="warn" />
                                <Stat label={t("pages.settings.custom_fields_mapping.stat_locked")} value={report.skipped_locked} tone="warn" />
                                <Stat label={t("pages.settings.custom_fields_mapping.stat_no_record")} value={report.no_target_record} tone="warn" />
                                {report.superseded > 0 && <Stat label={t("pages.settings.custom_fields_mapping.stat_superseded")} value={report.superseded} tone="warn" />}
                            </div>

                            {report.added_options.length > 0 && (
                                <div style={{ fontSize: 12, color: T.TEXT_MUTED, marginTop: 8 }}>
                                    {t("pages.settings.custom_fields_mapping.options_will_be_added")} {report.added_options.join(", ")}
                                </div>
                            )}

                            {report.incompatible_samples.length > 0 && (
                                <div style={{ marginTop: 10, fontSize: 12, color: T.TEXT_MUTED }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t("pages.settings.custom_fields_mapping.examples_heading")}</div>
                                    {report.incompatible_samples.map((s) => (
                                        <div key={`${s.record_id}-${s.value}`} style={{ padding: "2px 0" }}>
                                            #{s.record_id} · “{s.value}” — {td(s.reason, { source: "en" })}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {deleting && notMigrated > 0 && (
                                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, fontSize: 13, color: T.RED, cursor: "pointer" }}>
                                    <input type="checkbox" checked={allowLoss} onChange={(e) => setAllowLoss(e.target.checked)} style={{ marginTop: 3 }} />
                                    {t("pages.settings.custom_fields_mapping.loss_confirm", { n: notMigrated })}
                                </label>
                            )}
                        </div>
                    )}
                </>
            )}
        </Modal>
    );
}
