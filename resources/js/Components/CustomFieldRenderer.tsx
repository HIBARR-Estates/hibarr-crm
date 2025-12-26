import React, { useMemo } from 'react';
import {
    Form,
    Input,
    Select,
    DatePicker,
    Checkbox,
    Radio,
    Row,
    Col,
} from 'antd';
import { CustomField } from '@/Types';
import { useCustomFieldVisibility } from '@/Hooks/useCustomFieldVisibility';

interface Props {
    fields: CustomField[];
    form: any;
    namePrefix?: string;
}

const CustomFieldRenderer: React.FC<Props> = ({ 
    fields, 
    form, 
    namePrefix = 'custom_fields_data' 
}) => {
    // Get visibility map
    const { visibilityMap, isFieldVisible } = useCustomFieldVisibility({
        fields,
        form,
        namePrefix,
    });

    // Sort fields by display_order
    const sortedFields = useMemo(() => {
        return [...fields].sort((a, b) => {
            const orderA = a.display_order || 0;
            const orderB = b.display_order || 0;
            return orderA - orderB;
        });
    }, [fields]);

    const renderTextField = (field: CustomField) => (
        <Form.Item
            key={field.id}
            name={[namePrefix, `field_${field.id}`]}
            label={field.label}
            rules={
                field.required === 'yes' && isFieldVisible(field.id)
                    ? [{ required: true, message: `${field.label} is required` }]
                    : []
            }
        >
            <Input placeholder={`Enter ${field.label}`} />
        </Form.Item>
    );

    const renderNumberField = (field: CustomField) => (
        <Form.Item
            key={field.id}
            name={[namePrefix, `field_${field.id}`]}
            label={field.label}
            rules={
                field.required === 'yes' && isFieldVisible(field.id)
                    ? [{ required: true, message: `${field.label} is required` }]
                    : []
            }
        >
            <Input type="number" placeholder={`Enter ${field.label}`} />
        </Form.Item>
    );

    const renderTextAreaField = (field: CustomField) => (
        <Form.Item
            key={field.id}
            name={[namePrefix, `field_${field.id}`]}
            label={field.label}
            rules={
                field.required === 'yes' && isFieldVisible(field.id)
                    ? [{ required: true, message: `${field.label} is required` }]
                    : []
            }
        >
            <Input.TextArea 
                placeholder={`Enter ${field.label}`}
                rows={3}
            />
        </Form.Item>
    );

    const renderSelectField = (field: CustomField) => {
        const values = typeof field.values === 'string' 
            ? JSON.parse(field.values) 
            : field.values || [];

        return (
            <Form.Item
                key={field.id}
                name={[namePrefix, `field_${field.id}`]}
                label={field.label}
                rules={
                    field.required === 'yes' && isFieldVisible(field.id)
                        ? [{ required: true, message: `${field.label} is required` }]
                        : []
                }
            >
                <Select
                    placeholder={`Select ${field.label}`}
                    allowClear
                    options={values.map((value: string, index: number) => ({
                        value,
                        label: value,
                    }))}
                />
            </Form.Item>
        );
    };

    const renderRadioField = (field: CustomField) => {
        const values = typeof field.values === 'string' 
            ? JSON.parse(field.values) 
            : field.values || [];

        return (
            <Form.Item
                key={field.id}
                name={[namePrefix, `field_${field.id}`]}
                label={field.label}
                rules={
                    field.required === 'yes' && isFieldVisible(field.id)
                        ? [{ required: true, message: `${field.label} is required` }]
                        : []
                }
            >
                <Radio.Group>
                    {values.map((value: string, index: number) => (
                        <Radio key={index} value={value}>
                            {value}
                        </Radio>
                    ))}
                </Radio.Group>
            </Form.Item>
        );
    };

    const renderCheckboxField = (field: CustomField) => {
        const values = typeof field.values === 'string' 
            ? JSON.parse(field.values) 
            : field.values || [];

        return (
            <Form.Item
                key={field.id}
                name={[namePrefix, `field_${field.id}`]}
                label={field.label}
                rules={
                    field.required === 'yes' && isFieldVisible(field.id)
                        ? [{ required: true, message: `${field.label} is required` }]
                        : []
                }
            >
                <Checkbox.Group>
                    {values.map((value: string, index: number) => (
                        <Checkbox key={index} value={value}>
                            {value}
                        </Checkbox>
                    ))}
                </Checkbox.Group>
            </Form.Item>
        );
    };

    const renderDateField = (field: CustomField) => (
        <Form.Item
            key={field.id}
            name={[namePrefix, `field_${field.id}`]}
            label={field.label}
            rules={
                field.required === 'yes' && isFieldVisible(field.id)
                    ? [{ required: true, message: `${field.label} is required` }]
                    : []
            }
        >
            <DatePicker 
                placeholder={`Select ${field.label}`}
                style={{ width: '100%' }}
            />
        </Form.Item>
    );

    const renderField = (field: CustomField) => {
        // Check visibility
        if (!isFieldVisible(field.id)) {
            return null;
        }

        switch (field.type) {
            case 'text':
                return renderTextField(field);
            case 'number':
                return renderNumberField(field);
            case 'textarea':
                return renderTextAreaField(field);
            case 'select':
                return renderSelectField(field);
            case 'radio':
                return renderRadioField(field);
            case 'checkbox':
                return renderCheckboxField(field);
            case 'date':
                return renderDateField(field);
            default:
                return renderTextField(field);
        }
    };

    return (
        <Row gutter={[16, 16]}>
            {sortedFields.map(field => {
                const fieldElement = renderField(field);
                if (!fieldElement) return null;

                return (
                    <Col key={field.id} span={field.type === 'textarea' ? 24 : 12}>
                        {fieldElement}
                    </Col>
                );
            })}
        </Row>
    );
};

export default CustomFieldRenderer;