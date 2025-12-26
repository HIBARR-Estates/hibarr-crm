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
            message.error('Failed to save visibility rules');
            console.error('Save error:', error);
        } finally {
            setSaving(false);
        }
    };

    const operatorOptions = [
        { value: 'equals', label: 'equals' },
        { value: 'exists', label: 'exists (has value)' },
        { value: 'boolean', label: 'is boolean (true/false)' },
        { value: '>', label: 'greater than' },
        { value: '<', label: 'less than' },
        { value: '>=', label: 'greater than or equal' },
        { value: '<=', label: 'less than or equal' },
        { value: 'in', label: 'in list' },
        { value: 'not_in', label: 'not in list' },
    ];

    // Filter out the current field from available fields
    const referenceFields = availableFields.filter(f => f.id !== field.id);

    return (
        <div style={{ padding: '20px' }}>
            <Form form={form} layout="vertical">
                <Form.Item 
                    name="enabled"
                    label="Enable visibility rules"
                    valuePropName="checked"
                    initialValue={enabled}
                >
                    <Switch
                        checked={enabled}
                        onChange={(checked) => {
                            setEnabled(checked);
                            form.setFieldValue('enabled', checked);
                        }}
                    />
                    <Text type="secondary" style={{ marginLeft: 12 }}>
                        When enabled, this field will only be visible when the conditions below are met.
                    </Text>
                </Form.Item>

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
                                // Watch all criteria operators at the top level (not inside map)
                                const allCriteria = Form.useWatch('criteria', form) || [];

                                return (
                                    <>
                                        {fields.map((fieldItem, index) => {
                                            // Access operator from watched data instead of calling hook inside map
                                            const operator = allCriteria[fieldItem.name]?.operator;

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
                                                        <Select placeholder="Select operator">
                                                            {operatorOptions.map(op => (
                                                                <Select.Option key={op.value} value={op.value}>
                                                                    {op.label}
                                                                </Select.Option>
                                                            ))}
                                                        </Select>
                                                    </Form.Item>

                                                    {(operator === 'in' || operator === 'not_in') ? (
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
                                                    ) : operator !== 'exists' && operator !== 'boolean' ? (
                                                        <Form.Item
                                                            {...fieldItem}
                                                            name={[fieldItem.name, 'reference_value']}
                                                            label="Value"
                                                            rules={[{ required: true, message: 'Please enter a value' }]}
                                                        >
                                                            <Input placeholder="Enter value to compare" />
                                                        </Form.Item>
                                                    ) : null}

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

