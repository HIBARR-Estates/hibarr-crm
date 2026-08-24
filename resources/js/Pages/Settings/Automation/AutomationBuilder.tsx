import { useMemo, useRef, useState } from "react";
import { Select } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import Button from "@/Components/Redesign/primitives/Button";
import Switch from "@/Components/Redesign/primitives/Switch";
import Icon from "@/Components/Redesign/primitives/Icon";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { Automation, DealAutomationAction, DealAutomationCondition, SubjectType, TriggerKey } from "./types";
import { actionTypeIcon, actionTypeLabel, actionTypeSubtitle, triggerLabel, TRIGGER_SUBJECT } from "./shared";
import { conditionFieldGroups, conditionValueOptions, DEAL_SETTABLE_FIELDS, fieldValueOptions, fieldValueType, mergeTagGroups, operatorsForFieldType } from "./config/builderFields";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";
import useAutomationMutations from "./hooks/useAutomationMutations";
import TagPickerButton from "./components/TagPickerButton";

interface AutomationBuilderProps {
    automation?: Automation;
    onBack: () => void;
}

function newAction(subjectType: SubjectType): DealAutomationAction {
    return {
        action_type: subjectType === "deal" ? "stage_transition" : "set_field_value",
        target_stage_id: null,
        target_pipeline_id: null,
        forward_only: true,
        field_name: null,
        field_value: null,
        email_template_id: null,
        recipient_types: ["client"],
        recipient_user_ids: null,
        recipient_emails: null,
        title: null,
        content: null,
        assignee_type: "lead_owner",
        assignee_user_id: null,
        assigner_type: "lead_owner",
        assigner_user_id: null,
        due_date_delta_value: null,
        due_date_delta_unit: "days",
        due_time: null,
        meta_event_name: null,
        meta_event_value: null,
        wait_duration_value: null,
        wait_duration_unit: "minutes",
    };
}

function newCondition(): DealAutomationCondition {
    return { field: "", operator: "=", value: "" };
}

function userLabel(u: { id: number; name?: string; first_name?: string; last_name?: string }): string {
    return u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || `#${u.id}`;
}

function Connector() {
    return (
        <div className="flex flex-col items-center py-2">
            <div style={{ width: 2, height: 22, background: "#d5dbe4" }} />
        </div>
    );
}

const fieldLabelStyle = { fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED, display: "block", marginBottom: 5 } as const;

export default function AutomationBuilder({ automation, onBack }: AutomationBuilderProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { catalog, templates, metaEvents } = useAutomationWorkspace();
    const { createAutomation, updateAutomation, savingId } = useAutomationMutations();

    const [name, setName] = useState(automation?.name ?? t("app.automation.untitledAutomation"));
    const [subjectType, setSubjectType] = useState<SubjectType>(automation?.subject_type ?? "deal");
    const [pipelineId, setPipelineId] = useState<number | null>(automation?.pipeline_id ?? null);
    const [trigger, setTrigger] = useState<TriggerKey | null>(automation?.trigger ?? null);
    const [dateField, setDateField] = useState<string | null>(automation?.date_field ?? null);
    const [dateRecurrence, setDateRecurrence] = useState<"yearly" | "once" | null>(automation?.date_recurrence ?? null);
    const [waitMode, setWaitMode] = useState<"immediate" | "wait">(automation?.wait_duration_value ? "wait" : "immediate");
    const [waitValue, setWaitValue] = useState<string>(automation?.wait_duration_value ? String(automation.wait_duration_value) : "5");
    const [waitUnit, setWaitUnit] = useState<string>(automation?.wait_duration_unit ?? "minutes");
    const [active, setActive] = useState(automation?.active ?? true);
    const [priority, setPriority] = useState<string>(String(automation?.priority ?? 0));
    const [conditions, setConditions] = useState<DealAutomationCondition[]>(automation?.conditions ?? []);
    const [actions, setActions] = useState<DealAutomationAction[]>(
        automation?.actions?.length ? automation.actions : [newAction(subjectType)],
    );

    const isSaving = savingId === (automation?.id ?? "new");

    const allowedTriggers = useMemo(
        () => (Object.keys(TRIGGER_SUBJECT) as TriggerKey[]).filter((k) => {
            const s = TRIGGER_SUBJECT[k];
            return s === "any" || s === subjectType;
        }),
        [subjectType],
    );

    const allowedActionTypes = catalog ? (subjectType === "deal" ? catalog.dealActionTypes : catalog.leadActionTypes) : [];

    const fieldGroups = catalog ? conditionFieldGroups(subjectType, catalog) : [];
    const mergeGroups = useMemo(
        () => (catalog ? mergeTagGroups(subjectType, catalog) : []),
        [catalog, subjectType],
    );

    // Stable per-field ref objects (keyed by "title-<i>" etc.) for the merge-tag
    // picker to insert into at cursor position — a plain array-of-useRef can't
    // be used here since `actions` grows/shrinks, and hooks can't run in a loop.
    const fieldRefObjects = useRef(new Map<string, { current: HTMLInputElement | HTMLTextAreaElement | null }>());
    function getFieldRef(key: string) {
        if (!fieldRefObjects.current.has(key)) {
            fieldRefObjects.current.set(key, { current: null });
        }
        return fieldRefObjects.current.get(key)!;
    }

    const stagesForPipeline = (pid: number | null) =>
        catalog ? catalog.stages.filter((s) => !pid || s.lead_pipeline_id === pid) : [];

    function updateAction(index: number, patch: Partial<DealAutomationAction>) {
        setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
    }

    function removeAction(index: number) {
        setActions((prev) => prev.filter((_, i) => i !== index));
    }

    function updateCondition(index: number, patch: Partial<DealAutomationCondition>) {
        setConditions((prev) =>
            prev.map((c, i) => {
                if (i !== index) return c;
                const next = { ...c, ...patch };
                if (patch.field !== undefined) {
                    let allowed = operatorsForFieldType(fieldValueType(next.field, catalog));
                    if (next.field === "pipeline_stage_id") {
                        allowed = allowed.filter((op) => op.value !== "exists");
                    }
                    if (!allowed.some((op) => op.value === next.operator)) {
                        next.operator = (allowed[0]?.value ?? "=") as DealAutomationCondition["operator"];
                    }
                }
                return next;
            }),
        );
    }

    function removeCondition(index: number) {
        setConditions((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleSave() {
        const payload: Record<string, unknown> = {
            name,
            subject_type: subjectType,
            pipeline_id: subjectType === "deal" ? pipelineId : null,
            trigger: trigger || null,
            trigger_date_field: trigger === "date_based" ? dateField : null,
            trigger_date_recurrence: trigger === "date_based" ? dateRecurrence : null,
            wait_duration_value: waitMode === "wait" && waitValue ? Number(waitValue) : null,
            wait_duration_unit: waitMode === "wait" && waitValue ? waitUnit : null,
            priority: Number(priority) || 0,
            active: active ? 1 : undefined,
            conditions: conditions.filter((c) => c.field).map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
            actions: actions.map((a) => ({ ...a })),
        };

        const saved = automation
            ? await updateAutomation(automation.id, payload)
            : await createAutomation(payload);

        if (saved) onBack();
    }

    const trigger_ = trigger; // avoid shadow lint noise below
    const triggerSub = trigger_
        ? t("app.automation.triggerHint")
        : t("app.automation.selectTriggerHint");

    return (
        <div>
            <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 border-0 bg-transparent cursor-pointer p-0 mb-3"
                style={{ fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}
            >
                <Icon name="chevron-left" size={15} />
                {t("app.automation.backToAutomations")}
            </button>

            <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
                <div className="min-w-0 flex-1">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="border-0 bg-transparent outline-none"
                        style={{
                            fontFamily: "inherit",
                            fontSize: 22,
                            fontWeight: 700,
                            color: T.NAVY,
                            padding: "2px 4px",
                            marginLeft: -4,
                            borderRadius: 6,
                            width: "100%",
                            maxWidth: 480,
                        }}
                    />
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <label className="flex items-center gap-2" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                            {t("app.automation.automationFor")}
                            <SearchableSelect
                                value={subjectType}
                                onChange={(value) => setSubjectType(value as SubjectType)}
                                options={[
                                    { value: "deal", label: t("app.automation.deals") },
                                    { value: "lead", label: t("app.automation.leads") },
                                ]}
                                style={{ width: 110 }}
                            />
                        </label>
                        <label className="flex items-center gap-2" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                            {t("app.automation.priority")}
                            <input
                                type="number"
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="dr-input"
                                style={{ width: 70 }}
                            />
                        </label>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onBack}>
                        {t("app.cancel")}
                    </Button>
                    <Button variant="primary" loading={isSaving} onClick={handleSave} disabled={!name.trim() || actions.length === 0}>
                        {t("app.automation.saveAutomation")}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 items-start" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
                <div className="flex flex-col">
                    {/* trigger */}
                    <div className="rounded-[10px] border bg-white p-4" style={{ borderColor: T.BORDER }}>
                        <div className="mb-2.5" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.NAVY }}>
                            {t("app.automation.when")}
                        </div>
                        <SearchableSelect
                            value={trigger ?? undefined}
                            onChange={(value) => {
                                const next = (value ?? null) as TriggerKey | null;
                                setTrigger(next);
                                if (next !== "date_based") {
                                    setDateField(null);
                                    setDateRecurrence(null);
                                }
                            }}
                            options={allowedTriggers.map((k) => ({ value: k, label: td(triggerLabel(k)) }))}
                            allowClear
                            placeholder={t("app.automation.selectTrigger")}
                            className="w-full"
                        />

                        {trigger === "date_based" && catalog && (
                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <div>
                                    <label style={fieldLabelStyle}>{t("app.automation.dateField")}</label>
                                    <SearchableSelect
                                        value={dateField ?? undefined}
                                        onChange={(value) => setDateField(value ?? null)}
                                        options={Object.entries(catalog.dateFields[subjectType] ?? {}).map(([key, label]) => ({ value: key, label }))}
                                        allowClear
                                        placeholder={t("app.automation.selectField")}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label style={fieldLabelStyle}>{t("app.automation.recurrence")}</label>
                                    <SearchableSelect
                                        value={dateRecurrence ?? undefined}
                                        onChange={(value) => setDateRecurrence((value ?? null) as "yearly" | "once" | null)}
                                        options={Object.entries(catalog.dateRecurrences).map(([key, label]) => ({ value: key, label }))}
                                        allowClear
                                        placeholder={t("app.automation.selectRecurrence")}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        )}

                        {subjectType === "deal" && catalog && (
                            <div className="mt-3">
                                <label style={fieldLabelStyle}>{t("app.automation.pipelineScope")}</label>
                                <SearchableSelect
                                    value={pipelineId ?? undefined}
                                    onChange={(value) => setPipelineId(value ?? null)}
                                    options={catalog.pipelines.map((p) => ({ value: p.id, label: p.name }))}
                                    allowClear
                                    placeholder={t("app.automation.allPipelines")}
                                    className="w-full"
                                />
                            </div>
                        )}
                    </div>

                    <Connector />

                    {/* wait */}
                    <div className="rounded-[10px] border bg-white p-4" style={{ borderColor: T.BORDER }}>
                        <div className="mb-2.5" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.TEXT_MUTED }}>
                            {t("app.automation.waitBeforeRunning")}
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: T.TEXT }}>
                                <input
                                    type="radio"
                                    name="wait-mode"
                                    checked={waitMode === "immediate"}
                                    onChange={() => setWaitMode("immediate")}
                                />
                                {t("app.automation.runImmediately")}
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer flex-wrap" style={{ fontSize: 13, color: T.TEXT }}>
                                <input
                                    type="radio"
                                    name="wait-mode"
                                    checked={waitMode === "wait"}
                                    onChange={() => setWaitMode("wait")}
                                />
                                {t("app.automation.waitFor")}
                                <input
                                    type="number"
                                    min={1}
                                    max={3650}
                                    value={waitValue}
                                    onChange={(e) => {
                                        setWaitValue(e.target.value);
                                        setWaitMode("wait");
                                    }}
                                    onFocus={() => setWaitMode("wait")}
                                    className="dr-input"
                                    style={{ width: 90 }}
                                />
                                <SearchableSelect
                                    value={waitUnit}
                                    onChange={(value) => {
                                        setWaitUnit(value);
                                        setWaitMode("wait");
                                    }}
                                    options={Object.entries(catalog?.waitDurationUnits ?? {}).map(([key, label]) => ({ value: key, label }))}
                                    style={{ width: 140 }}
                                />
                                {t("app.automation.beforeRunning")}
                            </label>
                        </div>
                    </div>

                    <Connector />

                    {/* conditions */}
                    <div className="rounded-[10px] border bg-white p-4" style={{ borderColor: T.BORDER }}>
                        <div className="flex items-center justify-between mb-3">
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.TEXT_MUTED }}>
                                {t("app.automation.if")}{" "}
                                <span style={{ color: T.TEXT_HINT, fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
                                    · {t("app.automation.optional")}
                                </span>
                            </div>
                        </div>
                        {conditions.map((cond, i) => {
                            const valueType = fieldValueType(cond.field, catalog);
                            const inputType = valueType === "number" ? "number" : valueType === "date" ? "date" : "text";
                            // A deal always has a stage — "Exists" is trivially true and
                            // meaningless as a filter, so it's the one field that drops it.
                            const isStageField = cond.field === "pipeline_stage_id";
                            const operators = isStageField
                                ? operatorsForFieldType(valueType).filter((op) => op.value !== "exists")
                                : operatorsForFieldType(valueType);
                            const selectOptions = isStageField
                                ? stagesForPipeline(pipelineId).map((s) => ({ value: String(s.id), label: s.name }))
                                : conditionValueOptions(cond.field, catalog);
                            return (
                            <div key={i} className="flex items-center gap-2 mb-2" style={{ flexWrap: "wrap" }}>
                                <SearchableSelect
                                    value={cond.field || undefined}
                                    onChange={(value) => updateCondition(i, { field: value ?? "" })}
                                    options={fieldGroups}
                                    placeholder={t("app.automation.selectField")}
                                    popupMatchSelectWidth={280}
                                    style={{ flex: "1 1 200px" }}
                                />
                                <SearchableSelect
                                    value={cond.operator}
                                    onChange={(value) => updateCondition(i, { operator: value as DealAutomationCondition["operator"] })}
                                    options={operators}
                                    style={{ width: 150 }}
                                />
                                {cond.operator !== "exists" && cond.operator !== "changed" && (
                                    selectOptions && selectOptions.length > 0 ? (
                                        <SearchableSelect
                                            value={(cond.value as string) || undefined}
                                            onChange={(value) => updateCondition(i, { value: value ?? "" })}
                                            options={selectOptions}
                                            allowClear
                                            placeholder={t("app.automation.selectValue")}
                                            style={{ flex: "1 1 160px" }}
                                        />
                                    ) : (
                                        <input
                                            type={inputType}
                                            value={cond.value ?? ""}
                                            onChange={(e) => updateCondition(i, { value: e.target.value })}
                                            placeholder={t("app.automation.value")}
                                            className="dr-input"
                                            style={{ flex: "1 1 160px" }}
                                        />
                                    )
                                )}
                                <button
                                    type="button"
                                    aria-label={t("app.remove")}
                                    onClick={() => removeCondition(i)}
                                    className="border-0 bg-transparent cursor-pointer flex"
                                    style={{ color: T.TEXT_HINT }}
                                >
                                    <Icon name="x" size={14} />
                                </button>
                            </div>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => setConditions((prev) => [...prev, newCondition()])}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-lg cursor-pointer"
                            style={{ padding: "6px 11px", border: `1px dashed ${T.NAVY_MID}`, background: "none", color: T.BLUE, fontSize: 12, fontWeight: 600 }}
                        >
                            <PlusOutlined /> {t("app.automation.addCondition")}
                        </button>
                    </div>

                    <Connector />

                    <div className="mb-2.5" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.GREEN, marginLeft: 2 }}>
                        {t("app.automation.thenDoThis")}
                    </div>

                    {actions.map((step, i) => (
                        <div key={i} className="rounded-[10px] border bg-white mb-2.5" style={{ borderColor: T.BORDER, padding: "15px 16px" }}>
                            <div className="flex items-center gap-3 mb-3">
                                <span
                                    className="rounded-full flex items-center justify-center shrink-0"
                                    style={{ width: 26, height: 26, background: T.BLUE_LIGHT, color: T.BLUE_DARK, fontSize: 12, fontWeight: 700 }}
                                >
                                    {i + 1}
                                </span>
                                <span
                                    className="rounded-lg flex items-center justify-center shrink-0"
                                    style={{ width: 36, height: 36, background: T.SURFACE_2, border: `1px solid ${T.BORDER_SOFT}`, color: T.TEXT_MUTED }}
                                >
                                    <Icon name={actionTypeIcon(step.action_type)} size={16} />
                                </span>
                                <SearchableSelect
                                    value={step.action_type}
                                    onChange={(value) => updateAction(i, { action_type: value as DealAutomationAction["action_type"] })}
                                    options={allowedActionTypes.map((type) => ({ value: type, label: td(actionTypeLabel(type)) }))}
                                    className="flex-1"
                                />
                                <button
                                    type="button"
                                    aria-label={t("app.remove")}
                                    onClick={() => removeAction(i)}
                                    className="rounded-[7px] border bg-white cursor-pointer flex"
                                    style={{ padding: 6, borderColor: T.BORDER, color: T.TEXT_MUTED }}
                                >
                                    <Icon name="x" size={14} />
                                </button>
                            </div>
                            <div style={{ fontSize: 12, color: T.TEXT_HINT, marginBottom: 10 }}>
                                {step.action_type === "wait" && step.wait_duration_value
                                    ? t("app.automation.waitsDurationBeforeContinuing", {
                                          value: step.wait_duration_value,
                                          unit: catalog?.waitDurationUnits[step.wait_duration_unit ?? "minutes"] ?? step.wait_duration_unit,
                                      })
                                    : td(actionTypeSubtitle(step.action_type))}
                            </div>

                            {step.action_type === "stage_transition" && catalog && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label style={fieldLabelStyle}>{t("app.automation.targetPipeline")}</label>
                                        <SearchableSelect
                                            value={step.target_pipeline_id ?? undefined}
                                            onChange={(value) => updateAction(i, { target_pipeline_id: value ?? null })}
                                            options={catalog.pipelines.map((p) => ({ value: p.id, label: p.name }))}
                                            allowClear
                                            placeholder={t("app.automation.sameAsSource")}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{t("app.automation.targetStage")}</label>
                                        <SearchableSelect
                                            value={step.target_stage_id ?? undefined}
                                            onChange={(value) => updateAction(i, { target_stage_id: value ?? null })}
                                            options={stagesForPipeline(step.target_pipeline_id).map((s) => ({ value: s.id, label: s.name }))}
                                            allowClear
                                            placeholder={t("app.automation.selectStage")}
                                            className="w-full"
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 mt-5" style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                                        <input
                                            type="checkbox"
                                            checked={step.forward_only}
                                            onChange={(e) => updateAction(i, { forward_only: e.target.checked })}
                                        />
                                        {t("app.automation.forwardOnly")}
                                    </label>
                                </div>
                            )}

                            {step.action_type === "set_field_value" && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label style={fieldLabelStyle}>{t("app.automation.field")}</label>
                                        <SearchableSelect
                                            value={step.field_name ?? undefined}
                                            onChange={(value) => updateAction(i, { field_name: value ?? null, field_value: null })}
                                            options={
                                                subjectType === "deal"
                                                    ? Object.entries(DEAL_SETTABLE_FIELDS).map(([key, label]) => ({ value: key, label }))
                                                    : Object.entries(catalog?.leadSettableFields ?? {}).map(([key, label]) => ({ value: key, label }))
                                            }
                                            allowClear
                                            placeholder={t("app.automation.selectField")}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{t("app.automation.value")}</label>
                                        {(() => {
                                            const options = fieldValueOptions(step.field_name);
                                            if (options) {
                                                return (
                                                    <SearchableSelect
                                                        value={step.field_value ?? undefined}
                                                        onChange={(value) => updateAction(i, { field_value: value ?? null })}
                                                        options={options}
                                                        allowClear
                                                        placeholder={t("app.automation.selectValue")}
                                                        className="w-full"
                                                    />
                                                );
                                            }
                                            return (
                                                <input
                                                    value={step.field_value ?? ""}
                                                    onChange={(e) => updateAction(i, { field_value: e.target.value })}
                                                    className="dr-input w-full"
                                                    placeholder={t("app.automation.value")}
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {step.action_type === "lock_deal" && (
                                <div
                                    className="rounded-lg"
                                    style={{ background: T.AMBER_SOFT, border: `1px solid ${T.AMBER_MID}`, padding: "10px 12px", fontSize: 12, color: T.AMBER }}
                                >
                                    <Icon name="lock" size={13} /> {t("app.automation.lockDealHint")}
                                </div>
                            )}

                            {step.action_type === "send_email" && catalog && (
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <label style={fieldLabelStyle}>{t("app.automation.emailTemplate")}</label>
                                        <SearchableSelect
                                            value={step.email_template_id ?? undefined}
                                            onChange={(value) => updateAction(i, { email_template_id: value ?? null })}
                                            options={templates.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
                                            allowClear
                                            placeholder={t("app.automation.selectTemplate")}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{t("app.automation.sendTo")}</label>
                                        <div className="flex flex-wrap gap-3">
                                            {Object.entries(catalog.recipientTypes)
                                                .filter(([, meta]) => meta.subject === "any" || meta.subject === subjectType)
                                                .map(([key, meta]) => (
                                                    <label key={key} className="flex items-center gap-1.5" style={{ fontSize: 12, color: T.TEXT }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={(step.recipient_types ?? []).includes(key)}
                                                            onChange={(e) => {
                                                                const set = new Set(step.recipient_types ?? []);
                                                                if (e.target.checked) set.add(key);
                                                                else set.delete(key);
                                                                updateAction(i, { recipient_types: Array.from(set) });
                                                            }}
                                                        />
                                                        {meta.label}
                                                    </label>
                                                ))}
                                        </div>
                                    </div>
                                    {(step.recipient_types ?? []).includes("specific_user") && (
                                        <div>
                                            <label style={fieldLabelStyle}>{t("app.automation.specificUsers")}</label>
                                            <Select
                                                mode="multiple"
                                                value={step.recipient_user_ids ?? []}
                                                onChange={(values) => updateAction(i, { recipient_user_ids: values })}
                                                options={catalog.users.map((u) => ({ value: u.id, label: userLabel(u) }))}
                                                showSearch
                                                optionFilterProp="label"
                                                placeholder={t("app.automation.specificUsers")}
                                                className="w-full"
                                            />
                                        </div>
                                    )}
                                    {(step.recipient_types ?? []).includes("custom_email") && (
                                        <div>
                                            <label style={fieldLabelStyle}>{t("app.automation.customEmails")}</label>
                                            <textarea
                                                value={step.recipient_emails ?? ""}
                                                onChange={(e) => updateAction(i, { recipient_emails: e.target.value })}
                                                className="dr-input w-full"
                                                rows={2}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {(step.action_type === "create_task" || step.action_type === "create_note") && catalog && (
                                <div className="flex flex-col gap-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>
                                                    {step.action_type === "create_task"
                                                        ? t("app.automation.title")
                                                        : t("app.automation.noteTitleOptional")}
                                                </label>
                                                <TagPickerButton
                                                    groups={mergeGroups}
                                                    targetRef={getFieldRef(`title-${i}`)}
                                                    value={step.title ?? ""}
                                                    onChange={(next) => updateAction(i, { title: next })}
                                                />
                                            </div>
                                            <input
                                                ref={(el) => {
                                                    getFieldRef(`title-${i}`).current = el;
                                                }}
                                                value={step.title ?? ""}
                                                onChange={(e) => updateAction(i, { title: e.target.value })}
                                                className="dr-input w-full"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>
                                                    {step.action_type === "create_task" ? t("app.automation.description") : t("app.automation.content")}
                                                </label>
                                                <TagPickerButton
                                                    groups={mergeGroups}
                                                    targetRef={getFieldRef(`content-${i}`)}
                                                    value={step.content ?? ""}
                                                    onChange={(next) => updateAction(i, { content: next })}
                                                />
                                            </div>
                                            <input
                                                ref={(el) => {
                                                    getFieldRef(`content-${i}`).current = el;
                                                }}
                                                value={step.content ?? ""}
                                                onChange={(e) => updateAction(i, { content: e.target.value })}
                                                className="dr-input w-full"
                                            />
                                        </div>
                                    </div>
                                    {step.action_type === "create_task" && (
                                        <div>
                                            <label style={fieldLabelStyle}>{t("app.automation.assignTo")}</label>
                                            <div className="flex gap-2">
                                                <SearchableSelect
                                                    value={step.assignee_type ?? "lead_owner"}
                                                    onChange={(value) => updateAction(i, { assignee_type: value })}
                                                    options={Object.entries(catalog.assignmentTypes).map(([key, label]) => ({ value: key, label }))}
                                                    style={{ width: 160 }}
                                                />
                                                {step.assignee_type === "specific_user" && (
                                                    <SearchableSelect
                                                        value={step.assignee_user_id ?? undefined}
                                                        onChange={(value) => updateAction(i, { assignee_user_id: value ?? null })}
                                                        options={catalog.users.map((u) => ({ value: u.id, label: userLabel(u) }))}
                                                        allowClear
                                                        placeholder={t("app.automation.selectUser")}
                                                        className="flex-1"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label style={fieldLabelStyle}>{t("app.automation.createdBy")}</label>
                                        <div className="flex gap-2">
                                            <SearchableSelect
                                                value={step.assigner_type ?? "lead_owner"}
                                                onChange={(value) => updateAction(i, { assigner_type: value })}
                                                options={Object.entries(catalog.assignmentTypes).map(([key, label]) => ({ value: key, label }))}
                                                style={{ width: 160 }}
                                            />
                                            {step.assigner_type === "specific_user" && (
                                                <SearchableSelect
                                                    value={step.assigner_user_id ?? undefined}
                                                    onChange={(value) => updateAction(i, { assigner_user_id: value ?? null })}
                                                    options={catalog.users.map((u) => ({ value: u.id, label: userLabel(u) }))}
                                                    allowClear
                                                    placeholder={t("app.automation.selectUser")}
                                                    className="flex-1"
                                                />
                                            )}
                                        </div>
                                    </div>
                                    {step.action_type === "create_task" && (
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label style={fieldLabelStyle}>{t("app.automation.dueIn")}</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={3650}
                                                    value={step.due_date_delta_value ?? ""}
                                                    onChange={(e) => updateAction(i, { due_date_delta_value: e.target.value ? Number(e.target.value) : null })}
                                                    className="dr-input w-full"
                                                />
                                            </div>
                                            <div>
                                                <label style={fieldLabelStyle}>&nbsp;</label>
                                                <SearchableSelect
                                                    value={step.due_date_delta_unit ?? "days"}
                                                    onChange={(value) => updateAction(i, { due_date_delta_unit: value })}
                                                    options={Object.entries(catalog.dueDateDeltaUnits).map(([key, label]) => ({ value: key, label }))}
                                                    className="w-full"
                                                />
                                            </div>
                                            <div>
                                                <label style={fieldLabelStyle}>{t("app.automation.dueTime")}</label>
                                                <input
                                                    type="time"
                                                    value={step.due_time ?? ""}
                                                    onChange={(e) => updateAction(i, { due_time: e.target.value || null })}
                                                    className="dr-input w-full"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step.action_type === "meta_conversion" && catalog && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2">
                                        <label style={fieldLabelStyle}>{t("app.automation.eventName")}</label>
                                        <SearchableSelect
                                            value={step.meta_event_name || undefined}
                                            onChange={(value) => {
                                                const matched = metaEvents.find((ev) => ev.name === value);
                                                updateAction(i, {
                                                    meta_event_name: value ?? null,
                                                    meta_event_value: matched ? matched.value : step.meta_event_value,
                                                });
                                            }}
                                            options={metaEvents.map((ev) => ({ value: ev.name, label: ev.name }))}
                                            allowClear
                                            placeholder={t("app.automation.eventNamePlaceholder")}
                                            className="w-full"
                                        />
                                        {metaEvents.length === 0 && (
                                            <div className="mt-1.5" style={{ fontSize: 11, color: T.TEXT_HINT }}>
                                                {t("app.automation.noMetaEventsYet")}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{t("app.automation.eventValue")}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            value={step.meta_event_value ?? ""}
                                            onChange={(e) => updateAction(i, { meta_event_value: e.target.value ? Number(e.target.value) : null })}
                                            className="dr-input w-full"
                                        />
                                    </div>
                                </div>
                            )}

                            {step.action_type === "wait" && catalog && (
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: T.TEXT }}>
                                        <input
                                            type="radio"
                                            name={`wait-mode-${i}`}
                                            checked={!step.wait_duration_value}
                                            onChange={() => updateAction(i, { wait_duration_value: null })}
                                        />
                                        {t("app.automation.runImmediately")}
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer flex-wrap" style={{ fontSize: 13, color: T.TEXT }}>
                                        <input
                                            type="radio"
                                            name={`wait-mode-${i}`}
                                            checked={!!step.wait_duration_value}
                                            onChange={() => updateAction(i, { wait_duration_value: step.wait_duration_value ?? 5 })}
                                        />
                                        {t("app.automation.waitFor")}
                                        <input
                                            type="number"
                                            min={1}
                                            max={3650}
                                            value={step.wait_duration_value ?? ""}
                                            onChange={(e) =>
                                                updateAction(i, { wait_duration_value: e.target.value ? Number(e.target.value) : null })
                                            }
                                            className="dr-input"
                                            style={{ width: 90 }}
                                        />
                                        <SearchableSelect
                                            value={step.wait_duration_unit ?? "minutes"}
                                            onChange={(value) =>
                                                updateAction(i, {
                                                    wait_duration_unit: value as DealAutomationAction["wait_duration_unit"],
                                                    wait_duration_value: step.wait_duration_value ?? 5,
                                                })
                                            }
                                            options={Object.entries(catalog.waitDurationUnits).map(([key, label]) => ({ value: key, label }))}
                                            style={{ width: 140 }}
                                        />
                                        {t("app.automation.beforeRunning")}
                                    </label>
                                </div>
                            )}
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={() => setActions((prev) => [...prev, newAction(subjectType)])}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg cursor-pointer mt-0.5"
                        style={{ padding: 11, border: `1px dashed ${T.NAVY_MID}`, background: "none", color: T.BLUE, fontSize: 13, fontWeight: 600 }}
                    >
                        <PlusOutlined /> {t("app.automation.addStep")}
                    </button>
                </div>

                {/* right rail */}
                <div className="sticky top-6 flex flex-col gap-3">
                    <div className="rounded-[10px] border bg-white p-4" style={{ borderColor: T.BORDER }}>
                        <div className="mb-3" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.TEXT_MUTED }}>
                            {t("app.automation.settings")}
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>{t("app.automation.status")}</div>
                                <div style={{ fontSize: 12, color: T.TEXT_HINT }}>{t("app.automation.statusHint")}</div>
                            </div>
                            <Switch checked={active} onChange={() => setActive((v) => !v)} aria-label={t("app.automation.status")} />
                        </div>
                    </div>
                    <div className="rounded-[10px] p-4" style={{ background: T.SURFACE_2, border: `1px solid ${T.BORDER_SOFT}` }}>
                        <div className="mb-2.5" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.TEXT_MUTED }}>
                            {t("app.automation.summary")}
                        </div>
                        <div style={{ fontSize: 13, color: T.TEXT_MUTED, lineHeight: 1.6 }}>
                            {t("app.automation.summaryText", {
                                trigger: trigger ? td(triggerLabel(trigger)) : t("app.automation.selectTrigger"),
                                count: actions.length,
                            })}
                        </div>
                        <div className="mt-2" style={{ fontSize: 12, color: T.TEXT_HINT }}>
                            {triggerSub}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
