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
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { CustomField, ShowRuleSet, ShowCriterion } from '@/Types';

const { Text } = Typography;

/** How a reference field's value should be picked/compared, driving both the operator list and the value input. */
type ValueShape = 'boolean' | 'single-option' | 'multi-option' | 'free';

/** `CustomField.values` arrives as a JSON-stringified array (or null) — see toRuleBuilderField. */
function parseJsonStringArray(raw: unknown): string[] {
    if (typeof raw !== 'string' || raw === '') return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
        return [];
    }
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
    // Hooks can only be called from a component's own render, never from a
    // plain callback like Form.List's `children` render-prop (that function
    // is invoked directly by rc-field-form, not through React.createElement,
    // so there's no guarantee a hook dispatcher is active there) — watch here
    // instead and read the array by index further down.
    const watchedCriteria = Form.useWatch('criteria', form) ?? [];

    useEffect(() => {
        if (ruleSet) {
            const enabledValue = ruleSet.enabled ?? false;
            form.setFieldsValue({
                default_visibility: ruleSet.default_visibility,
                enabled: enabledValue,
                group_operator: ruleSet.group?.group_operator ?? 'AND',
                criteria: ruleSet.group?.criteria?.map(c => ({
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
                    criteria: values.criteria || [],
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
                                        {fields.map((fieldItem, index) => {
                                            // Read from the component-level watch instead of
                                            // calling a hook inside this render-prop.
                                            const criterion = watchedCriteria[fieldItem.name] ?? {};
                                            const operator = criterion.operator;
                                            const referenceField = referenceFields.find(
                                                f => f.id === criterion.reference_field_id,
                                            ) ?? null;
                                            const referenceOptions = parseJsonStringArray(referenceField?.values ?? null);
                                            const shape = getValueShape(referenceField, referenceOptions);
                                            const shapeOperators = OPERATORS_BY_SHAPE[shape];
                                            // Keep a legacy/no-longer-valid operator visible as its own
                                            // option rather than silently blanking the select, so switching
                                            // away from an old rule doesn't look broken before it's touched.
                                            const operatorSelectOptions = shapeOperators.some(op => op.value === operator)
                                                ? shapeOperators
                                                : operator
                                                  ? [...shapeOperators, { value: operator, label: operator }]
                                                  : shapeOperators;
                                            const valueSelectOptions = referenceOptions.map(opt => ({ value: opt, label: opt }));

                                            return (
                                            <Card
                                                key={fieldItem.key}
                                                style={{ marginBottom: 16 }}
                                                title={`Criterion ${index + 1}`}
                                                extra={
                                                    <Button
                                                        type="text"
                                                        danger
                                                        icon={<DeleteOutlined />}
                                                        onClick={() => remove(fieldItem.name)}
                                                    >
                                                        Remove
                                                    </Button>
                                                }
                                            >
                                                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                                    <Form.Item
                                                        {...fieldItem}
                                                        name={[fieldItem.name, 'reference_field_id']}
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
                                                                // Options (and often valid operators) belong to the
                                                                // specific field just picked — a value/operator kept
                                                                // from the previous reference field would be stale.
                                                                const newField = referenceFields.find(f => f.id === value) ?? null;
                                                                const newOptions = parseJsonStringArray(newField?.values ?? null);
                                                                const allowedOps = OPERATORS_BY_SHAPE[getValueShape(newField, newOptions)]
                                                                    .map(op => op.value);
                                                                const currentOperator = form.getFieldValue([
                                                                    'criteria',
                                                                    fieldItem.name,
                                                                    'operator',
                                                                ]);
                                                                form.setFieldValue(
                                                                    ['criteria', fieldItem.name, 'reference_value'],
                                                                    undefined,
                                                                );
                                                                if (currentOperator && !allowedOps.includes(currentOperator)) {
                                                                    form.setFieldValue(
                                                                        ['criteria', fieldItem.name, 'operator'],
                                                                        undefined,
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {referenceFields.map(f => (
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
                                                        {...fieldItem}
                                                        name={[fieldItem.name, 'operator']}
                                                        label="Operator"
                                                        rules={[{ required: true, message: 'Please select an operator' }]}
                                                    >
                                                        <Select
                                                            placeholder="Select operator"
                                                            onChange={() => {
                                                                // The previous operator's value may be shaped
                                                                // differently (a JSON-array string for in/not_in
                                                                // vs. a plain scalar for equals) — stale reuse
                                                                // would silently pass validation in the new shape.
                                                                form.setFieldValue(
                                                                    ['criteria', fieldItem.name, 'reference_value'],
                                                                    undefined,
                                                                );
                                                            }}
                                                        >
                                                            {operatorSelectOptions.map(op => (
                                                                <Select.Option key={op.value} value={op.value}>
                                                                    {op.label}
                                                                </Select.Option>
                                                            ))}
                                                        </Select>
                                                    </Form.Item>

                                                    {operator === 'exists' || operator === 'boolean' ? null
                                                        : shape === 'single-option' && operator === 'equals' ? (
                                                        <Form.Item
                                                            {...fieldItem}
                                                            name={[fieldItem.name, 'reference_value']}
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
                                                            {...fieldItem}
                                                            name={[fieldItem.name, 'reference_value']}
                                                            label="Values"
                                                            rules={[
                                                                { required: true, message: 'Please select at least one value' },
                                                                {
                                                                    // getValueFromEvent always stringifies, even an
                                                                    // empty selection ("[]") — a non-empty string,
                                                                    // so `required` alone lets it through.
                                                                    validator: (_, value) =>
                                                                        parseJsonStringArray(value).length > 0
                                                                            ? Promise.resolve()
                                                                            : Promise.reject(new Error('Please select at least one value')),
                                                                },
                                                            ]}
                                                            // Keep storing the same JSON-array-string shape the
                                                            // free-typed textarea below always has (and the backend's
                                                            // json_decode expects) — only the picker UI changes.
                                                            getValueFromEvent={(selected: string[]) => JSON.stringify(selected ?? [])}
                                                            getValueProps={value => ({ value: parseJsonStringArray(value) })}
                                                        >
                                                            <Select
                                                                mode="multiple"
                                                                placeholder="Select values"
                                                                options={valueSelectOptions}
                                                            />
                                                        </Form.Item>
                                                    ) : (operator === 'in' || operator === 'not_in') ? (
                                                        <Form.Item
                                                            {...fieldItem}
                                                            name={[fieldItem.name, 'reference_value']}
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
                                                                                    new Error('Must be a JSON array, e.g., ["Yes", "No"]')
                                                                                );
                                                                            }
                                                                            return Promise.resolve();
                                                                        } catch {
                                                                            return Promise.reject(
                                                                                new Error('Invalid JSON format')
                                                                            );
                                                                        }
                                                                    },
                                                                },
                                                            ]}
                                                            tooltip='Enter values as JSON array, e.g., ["Yes", "No", "Maybe"]'
                                                        >
                                                            <Input.TextArea
                                                                placeholder='["Yes", "No"]'
                                                                rows={3}
                                                            />
                                                        </Form.Item>
                                                    ) : (
                                                        <Form.Item
                                                            {...fieldItem}
                                                            name={[fieldItem.name, 'reference_value']}
                                                            label="Value"
                                                            rules={[{ required: true, message: 'Please enter a value' }]}
                                                        >
                                                            <Input placeholder="Enter value to compare" />
                                                        </Form.Item>
                                                    )}

                                                    <Form.Item
                                                        {...fieldItem}
                                                        name={[fieldItem.name, 'negate']}
                                                        valuePropName="checked"
                                                        initialValue={false}
                                                    >
                                                        <Checkbox>Negate (NOT) - Reverse the condition</Checkbox>
                                                    </Form.Item>
                                                </Space>
                                            </Card>
                                        );
                                    })}

                                    <Button
                                        type="dashed"
                                        onClick={() => add()}
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

