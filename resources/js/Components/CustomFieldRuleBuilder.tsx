import React, { useState, useEffect } from 'react';
import {
    Form,
    Switch,
    Radio,
    Select,
    Input,
    Button,
    Card,
    Space,
    Typography,
    Checkbox,
    message,
} from 'antd';
import type { FormInstance } from 'antd/es/form';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { CustomField, ShowRuleSet } from '@/Types';
import usePipelineOptions, { PipelineOption } from '@/lib/usePipelineOptions';
import RecordSelect from './RecordSelect';

const { Text } = Typography;

type ReferenceSource = 'custom_field' | 'pipeline' | 'pipeline_stage' | 'record';

const SOURCE_OPTIONS: { value: ReferenceSource; label: string }[] = [
    { value: 'custom_field', label: 'Custom field' },
    { value: 'pipeline', label: 'Pipeline' },
    { value: 'pipeline_stage', label: 'Pipeline stage' },
    { value: 'record', label: 'Record' },
];

/** How a reference field's value should be picked/compared, driving both the operator list and the value input. */
type ValueShape = 'boolean' | 'single-option' | 'multi-option' | 'free';

/** `CustomField.values` arrives as a JSON-stringified array (or null) — see toRuleBuilderField. */
function parseJsonArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string' || raw === '') return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function parseJsonStringArray(raw: unknown): string[] {
    return parseJsonArray(raw).filter((v): v is string => typeof v === 'string');
}

function parseIdList(raw: unknown): number[] {
    if (raw === null || raw === undefined || raw === '') return [];
    const fromArray = parseJsonArray(raw);
    if (fromArray.length > 0) {
        return fromArray.map(Number).filter((n) => Number.isFinite(n));
    }
    const n = Number(raw);
    return Number.isFinite(n) ? [n] : [];
}

/**
 * select/radio hold one value, multiselect always holds many, and checkbox is
 * dual-purpose: a bare boolean toggle with no configured options, or a
 * multi-select checklist once options are set.
 */
function getValueShape(field: CustomField | null, options: string[]): ValueShape {
    if (!field) return 'free';
    if (field.type === 'multiselect') return 'multi-option';
    if (field.type === 'checkbox') return options.length > 0 ? 'multi-option' : 'boolean';
    if ((field.type === 'select' || field.type === 'radio') && options.length > 0) return 'single-option';
    return 'free';
}

const OPERATORS_BY_SHAPE: Record<ValueShape, { value: string; label: string }[]> = {
    boolean: [
        { value: 'boolean', label: 'is true' },
        { value: 'exists', label: 'exists (has value)' },
    ],
    'single-option': [
        { value: 'equals', label: 'equals' },
        { value: 'exists', label: 'exists (has value)' },
        { value: 'in', label: 'is one of' },
        { value: 'not_in', label: 'is not one of' },
    ],
    'multi-option': [
        { value: 'exists', label: 'exists (has value)' },
        { value: 'in', label: 'includes one of' },
        { value: 'not_in', label: 'includes none of' },
    ],
    // Text/number/date/etc — no fixed option list to pick from, so keep the
    // original free-typed behavior (also the fallback while no reference
    // field is selected yet).
    free: [
        { value: 'equals', label: 'equals' },
        { value: 'exists', label: 'exists (has value)' },
        { value: 'boolean', label: 'is boolean (true/false)' },
        { value: '>', label: 'greater than' },
        { value: '<', label: 'less than' },
        { value: '>=', label: 'greater than or equal' },
        { value: '<=', label: 'less than or equal' },
        { value: 'in', label: 'in list' },
        { value: 'not_in', label: 'not in list' },
    ],
};

function pipelineSourceExists(
    source: 'pipeline' | 'pipeline_stage',
    rawValue: unknown,
    pipelines: PipelineOption[],
): boolean {
    const values = parseIdList(rawValue);
    if (values.length === 0) return false;
    if (source === 'pipeline') {
        const allowed = new Set(pipelines.map((p) => p.id));
        return values.every((id) => allowed.has(id));
    }
    const allowed = new Set(pipelines.flatMap((p) => p.stages.map((s) => s.id)));
    return values.every((id) => allowed.has(id));
}

interface CriterionRowProps {
    name: number;
    restField: object;
    index: number;
    remove: (name: number) => void;
    form: FormInstance;
    referenceFields: CustomField[];
    pipelines: PipelineOption[];
    /** The field being edited — its own id, used by the "record" source to search its module's records. */
    fieldId: number;
}

/**
 * One criterion card. Watches this row's source/operator itself so switching
 * Source remounts a single branch — the parent Form.List render-prop does
 * not re-run on leaf changes, and reading source from getFieldValue there
 * painted both the custom-field and pipeline controls at once.
 */
const CriterionRow: React.FC<CriterionRowProps> = ({
    name,
    restField,
    index,
    remove,
    form,
    referenceFields,
    pipelines,
    fieldId,
}) => {
    const source: ReferenceSource =
        Form.useWatch(['criteria', name, 'reference_source'], form) ?? 'custom_field';
    const operator = Form.useWatch(['criteria', name, 'operator'], form);
    const referenceFieldId = Form.useWatch(['criteria', name, 'reference_field_id'], form);

    const stageOptions = pipelines.flatMap((p) =>
        p.stages.map((s) => ({ value: String(s.id), label: `${p.name} · ${s.name}` })),
    );
    const pipelineOptions = pipelines.map((p) => ({ value: String(p.id), label: p.name }));
    const referenceField =
        referenceFields.find((f) => f.id === referenceFieldId) ?? null;
    const referenceOptions = parseJsonStringArray(referenceField?.values ?? null);
    const shape = getValueShape(referenceField, referenceOptions);
    const shapeOperators = OPERATORS_BY_SHAPE[shape];
    const operatorSelectOptions = shapeOperators.some((op) => op.value === operator)
        ? shapeOperators
        : operator
          ? [...shapeOperators, { value: operator, label: String(operator) }]
          : shapeOperators;
    const valueSelectOptions = referenceOptions.map((opt) => ({ value: opt, label: opt }));

    const resetValue = () =>
        form.setFieldValue(['criteria', name, 'reference_value'], undefined);

    return (
        <Card
            style={{ marginBottom: 16 }}
            title={`Criterion ${index + 1}`}
            extra={
                <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => remove(name)}
                >
                    Remove
                </Button>
            }
        >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Form.Item
                    {...restField}
                    name={[name, 'reference_source']}
                    label="Source"
                    initialValue="custom_field"
                    tooltip="What this criterion reads — another field's value, the deal's pipeline/stage, or specific record(s)"
                >
                    <Select
                        options={SOURCE_OPTIONS}
                        onChange={(next: ReferenceSource) => {
                            form.setFieldValue(['criteria', name, 'reference_field_id'], undefined);
                            form.setFieldValue(['criteria', name, 'reference_value'], undefined);
                            form.setFieldValue(
                                ['criteria', name, 'operator'],
                                next === 'custom_field' ? undefined : next === 'record' ? 'in' : 'equals',
                            );
                        }}
                    />
                </Form.Item>

                <div key={source}>
                    {source === 'custom_field' ? (
                        <>
                            <Form.Item
                                {...restField}
                                name={[name, 'reference_field_id']}
                                label="Reference Field"
                                rules={[{ required: true, message: 'Please select a field' }]}
                                tooltip="The field whose value will be evaluated"
                            >
                                <Select
                                    placeholder="Select a field"
                                    showSearch
                                    filterOption={(input, option) =>
                                        String(option?.label ?? '')
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    onChange={(value: number) => {
                                        const newField =
                                            referenceFields.find((f) => f.id === value) ?? null;
                                        const newOptions = parseJsonStringArray(
                                            newField?.values ?? null,
                                        );
                                        const allowedOps = OPERATORS_BY_SHAPE[
                                            getValueShape(newField, newOptions)
                                        ].map((op) => op.value);
                                        const currentOperator = form.getFieldValue([
                                            'criteria',
                                            name,
                                            'operator',
                                        ]);
                                        resetValue();
                                        if (currentOperator && !allowedOps.includes(currentOperator)) {
                                            form.setFieldValue(['criteria', name, 'operator'], undefined);
                                        }
                                    }}
                                >
                                    {referenceFields.map((f) => (
                                        <Select.Option
                                            key={f.id}
                                            value={f.id}
                                            label={f.label}
                                        >
                                            {f.label} ({f.type})
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                {...restField}
                                name={[name, 'operator']}
                                label="Operator"
                                rules={[{ required: true, message: 'Please select an operator' }]}
                            >
                                <Select placeholder="Select operator" onChange={resetValue}>
                                    {operatorSelectOptions.map((op) => (
                                        <Select.Option key={op.value} value={op.value}>
                                            {op.label}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            {operator === 'exists' || operator === 'boolean' ? null
                                : shape === 'single-option' && operator === 'equals' ? (
                                <Form.Item
                                    {...restField}
                                    name={[name, 'reference_value']}
                                    label="Value"
                                    rules={[{ required: true, message: 'Please select a value' }]}
                                >
                                    <Select
                                        placeholder="Select a value"
                                        showSearch
                                        options={valueSelectOptions}
                                    />
                                </Form.Item>
                            ) : (shape === 'single-option' || shape === 'multi-option')
                                && (operator === 'in' || operator === 'not_in') ? (
                                <Form.Item
                                    {...restField}
                                    name={[name, 'reference_value']}
                                    label="Values"
                                    rules={[
                                        { required: true, message: 'Please select at least one value' },
                                        {
                                            validator: (_, value) =>
                                                parseJsonStringArray(value).length > 0
                                                    ? Promise.resolve()
                                                    : Promise.reject(new Error('Please select at least one value')),
                                        },
                                    ]}
                                    getValueFromEvent={(selected: string[]) =>
                                        JSON.stringify(selected ?? [])
                                    }
                                    getValueProps={(value) => ({ value: parseJsonStringArray(value) })}
                                >
                                    <Select
                                        mode="multiple"
                                        placeholder="Select values"
                                        options={valueSelectOptions}
                                    />
                                </Form.Item>
                            ) : operator === 'in' || operator === 'not_in' ? (
                                <Form.Item
                                    {...restField}
                                    name={[name, 'reference_value']}
                                    label="Value (JSON Array)"
                                    rules={[
                                        { required: true, message: 'Please enter values' },
                                        {
                                            validator: (_, value) => {
                                                if (!value) return Promise.resolve();
                                                try {
                                                    const parsed = JSON.parse(value);
                                                    if (!Array.isArray(parsed)) {
                                                        return Promise.reject(
                                                            new Error('Must be a JSON array, e.g., ["Yes", "No"]'),
                                                        );
                                                    }
                                                    return Promise.resolve();
                                                } catch {
                                                    return Promise.reject(
                                                        new Error('Invalid JSON format'),
                                                    );
                                                }
                                            },
                                        },
                                    ]}
                                    tooltip='Enter values as JSON array, e.g., ["Yes", "No", "Maybe"]'
                                >
                                    <Input.TextArea placeholder='["Yes", "No"]' rows={3} />
                                </Form.Item>
                            ) : operator ? (
                                <Form.Item
                                    {...restField}
                                    name={[name, 'reference_value']}
                                    label="Value"
                                    rules={[{ required: true, message: 'Please enter a value' }]}
                                >
                                    <Input placeholder="Enter value to compare" />
                                </Form.Item>
                            ) : null}
                        </>
                    ) : source === 'record' ? (
                        <>
                            <Form.Item
                                {...restField}
                                name={[name, 'operator']}
                                label="Operator"
                                initialValue="in"
                                rules={[{ required: true, message: 'Please select an operator' }]}
                            >
                                <Select
                                    placeholder="Select operator"
                                    onChange={resetValue}
                                    options={[
                                        { value: 'in', label: 'is one of' },
                                        { value: 'not_in', label: 'is not one of' },
                                    ]}
                                />
                            </Form.Item>

                            <Form.Item
                                {...restField}
                                name={[name, 'reference_value']}
                                label="Record(s)"
                                tooltip="This field only shows for the record(s) picked here — one record, or a chosen list."
                                rules={[
                                    { required: true, message: 'Please select at least one record' },
                                    {
                                        validator: (_, value) =>
                                            parseIdList(value).length > 0
                                                ? Promise.resolve()
                                                : Promise.reject(new Error('Please select at least one record')),
                                    },
                                ]}
                                getValueFromEvent={(selected: string[]) =>
                                    JSON.stringify((selected ?? []).map(String))
                                }
                                getValueProps={(value) => ({
                                    value: parseIdList(value).map(String),
                                })}
                            >
                                <RecordSelect fieldId={fieldId} placeholder="Search records…" />
                            </Form.Item>
                        </>
                    ) : (
                        <>
                            <Form.Item
                                {...restField}
                                name={[name, 'operator']}
                                label="Operator"
                                rules={[{ required: true, message: 'Please select an operator' }]}
                            >
                                <Select
                                    placeholder="Select operator"
                                    onChange={resetValue}
                                    options={
                                        source === 'pipeline_stage'
                                            ? [
                                                  { value: 'equals', label: 'equals' },
                                                  { value: 'in', label: 'is one of' },
                                                  { value: 'not_in', label: 'is not one of' },
                                                  { value: '>', label: 'is after (later than)' },
                                                  { value: '<', label: 'is before (earlier than)' },
                                                  { value: '>=', label: 'is at or after' },
                                                  { value: '<=', label: 'is at or before' },
                                              ]
                                            : [
                                                  { value: 'equals', label: 'equals' },
                                                  { value: 'in', label: 'is one of' },
                                                  { value: 'not_in', label: 'is not one of' },
                                              ]
                                    }
                                />
                            </Form.Item>

                            {operator === 'in' || operator === 'not_in' ? (
                                <Form.Item
                                    {...restField}
                                    name={[name, 'reference_value']}
                                    label="Values"
                                    rules={[
                                        { required: true, message: 'Please select at least one value' },
                                        {
                                            validator: (_, value) =>
                                                parseIdList(value).length > 0
                                                    ? Promise.resolve()
                                                    : Promise.reject(new Error('Please select at least one value')),
                                        },
                                    ]}
                                    getValueFromEvent={(selected: (string | number)[]) =>
                                        JSON.stringify((selected ?? []).map(String))
                                    }
                                    getValueProps={(value) => ({
                                        value: parseIdList(value).map(String),
                                    })}
                                >
                                    <Select
                                        mode="multiple"
                                        placeholder={
                                            source === 'pipeline_stage'
                                                ? 'Select stages'
                                                : 'Select pipelines'
                                        }
                                        options={
                                            source === 'pipeline_stage'
                                                ? stageOptions
                                                : pipelineOptions
                                        }
                                    />
                                </Form.Item>
                            ) : operator ? (
                                <Form.Item
                                    {...restField}
                                    name={[name, 'reference_value']}
                                    label="Value"
                                    rules={[
                                        { required: true, message: 'Please select a value' },
                                        {
                                            validator: (_, value) =>
                                                pipelines.length === 0 || pipelineSourceExists(source, value, pipelines)
                                                    ? Promise.resolve()
                                                    : Promise.reject(new Error('Please select a valid value')),
                                        },
                                    ]}
                                    getValueFromEvent={(v: string | number | null) =>
                                        v == null || v === '' ? undefined : String(v)
                                    }
                                    getValueProps={(value) => ({
                                        value:
                                            value === null || value === undefined || value === ''
                                                ? undefined
                                                : String(value),
                                    })}
                                >
                                    <Select
                                        placeholder={
                                            source === 'pipeline_stage'
                                                ? 'Select a stage'
                                                : 'Select a pipeline'
                                        }
                                        showSearch
                                        filterOption={(input, option) =>
                                            String(option?.label ?? '')
                                                .toLowerCase()
                                                .includes(input.toLowerCase())
                                        }
                                        options={
                                            source === 'pipeline_stage'
                                                ? stageOptions
                                                : pipelineOptions
                                        }
                                    />
                                </Form.Item>
                            ) : null}
                        </>
                    )}
                </div>

                <Form.Item
                    {...restField}
                    name={[name, 'negate']}
                    valuePropName="checked"
                    initialValue={false}
                >
                    <Checkbox>Negate (NOT) - Reverse the condition</Checkbox>
                </Form.Item>
            </Space>
        </Card>
    );
};

interface Props {
    field: CustomField;
    availableFields: CustomField[]; // All fields that can be used as references
    ruleSet?: ShowRuleSet | null;
    onSave: (ruleSet: Partial<ShowRuleSet>) => Promise<void>;
    onCancel: () => void;
    loading?: boolean;
}

const CustomFieldRuleBuilder: React.FC<Props> = ({
    field,
    availableFields,
    ruleSet,
    onSave,
    onCancel,
    loading = false,
}) => {
    const [form] = Form.useForm();
    const [enabled, setEnabled] = useState(ruleSet?.enabled ?? false);
    const [saving, setSaving] = useState(false);
    const pipelines = usePipelineOptions();

    useEffect(() => {
        if (ruleSet) {
            const enabledValue = ruleSet.enabled ?? false;
            form.setFieldsValue({
                default_visibility: ruleSet.default_visibility,
                enabled: enabledValue,
                group_operator: ruleSet.group?.group_operator ?? 'AND',
                criteria: ruleSet.group?.criteria?.map(c => ({
                    reference_source: c.reference_source ?? 'custom_field',
                    reference_field_id: c.reference_field_id,
                    operator: c.operator,
                    reference_value: c.reference_value,
                    negate: c.negate,
                })) ?? [],
            });
            setEnabled(enabledValue);
        } else {
            form.resetFields();
            setEnabled(false);
            // Ensure enabled is set to false in form
            form.setFieldValue('enabled', false);
        }
    }, [ruleSet, form]);

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);

            const ruleSetData: any = {
                field_id: field.id,
                default_visibility: values.default_visibility,
                enabled: values.enabled,
                group: {
                    group_operator: values.group_operator,
                    criteria: (values.criteria || []).map((c: Record<string, unknown>) => ({
                        ...c,
                        reference_value:
                            c.reference_value == null || c.reference_value === ''
                                ? null
                                : typeof c.reference_value === 'number'
                                  ? String(c.reference_value)
                                  : c.reference_value,
                    })),
                },
            };

            await onSave(ruleSetData);
            message.success('Visibility rules saved successfully');
        } catch (error: any) {
            if (error.errorFields) {
                // Validation errors
                return;
            }
            // onSave (VisibilityRuleModal's handleSave) already shows the
            // specific error message — don't stack a second, generic one.
            console.error('Save error:', error);
        } finally {
            setSaving(false);
        }
    };

    // Filter out the current field from available fields
    const referenceFields = availableFields.filter(f => f.id !== field.id);

    return (
        <div style={{ padding: '20px' }}>
            <Form form={form} layout="vertical">
                {/* Form.Item with a `name` prop clones exactly one child to wire up
                    value/onChange — the caption lives outside it, not as a second
                    child, since it isn't part of the control. */}
                <Form.Item
                    name="enabled"
                    label="Enable visibility rules"
                    valuePropName="checked"
                    initialValue={enabled}
                    style={{ marginBottom: 4 }}
                >
                    <Switch
                        checked={enabled}
                        onChange={(checked) => {
                            setEnabled(checked);
                            form.setFieldValue('enabled', checked);
                        }}
                    />
                </Form.Item>
                <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                    When enabled, this field will only be visible when the conditions below are met.
                </Text>

                <Form.Item
                    name="default_visibility"
                    label="Default Visibility"
                    initialValue={true}
                    tooltip="What should happen when rules are disabled or no rules match?"
                >
                    <Radio.Group>
                        <Radio value={true}>Show (default)</Radio>
                        <Radio value={false}>Hide (default)</Radio>
                    </Radio.Group>
                </Form.Item>

                {enabled && (
                    <Card title="Rule Group" style={{ marginTop: 16 }}>
                        <Form.Item
                            name="group_operator"
                            label="Group Operator"
                            initialValue="AND"
                            tooltip="AND: All criteria must match. OR: At least one criterion must match."
                        >
                            <Select>
                                <Select.Option value="AND">
                                    AND (all criteria must match)
                                </Select.Option>
                                <Select.Option value="OR">
                                    OR (any criterion must match)
                                </Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.List name="criteria">
                            {(fields, { add, remove }) => {
                                return (
                                    <>
                                        {fields.map(({ key, name, ...restField }, index) => (
                                            <CriterionRow
                                                key={key}
                                                name={name}
                                                restField={restField}
                                                index={index}
                                                remove={remove}
                                                form={form}
                                                referenceFields={referenceFields}
                                                pipelines={pipelines}
                                                fieldId={field.id}
                                            />
                                        ))}

                                    <Button
                                        type="dashed"
                                        onClick={() => add({ reference_source: 'custom_field', negate: false })}

                                        block
                                        icon={<PlusOutlined />}
                                        style={{ marginTop: 16 }}
                                    >
                                        Add Criterion
                                    </Button>
                                    </>
                                );
                            }}
                        </Form.List>
                    </Card>
                )}

                <Form.Item style={{ marginTop: 24 }}>
                    <Space>
                        <Button onClick={onCancel} disabled={saving || loading}>
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleSave}
                            loading={saving || loading}
                        >
                            Save Rules
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </div>
    );
};

export default CustomFieldRuleBuilder;

