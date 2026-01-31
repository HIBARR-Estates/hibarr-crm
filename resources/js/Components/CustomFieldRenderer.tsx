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
import PhoneInput from 'antd-phone-input';
import { CustomField } from '@/Types';
import { useCustomFieldVisibility } from '@/Hooks/useCustomFieldVisibility';
import { usePage } from '@inertiajs/react';
import CurrencyInput from '@/Components/CurrencyInput';
import RepeatableFieldRenderer from '@/Components/RepeatableFieldRenderer';

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
    const { props } = usePage<any>();
    const { countries = [] } = props;
    
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

    const renderCountryField = (field: CustomField) => (
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
                showSearch
                filterOption={(input, option) => {
                    const searchText = input.toLowerCase();
                    const countryValue = option?.value as string;
                    const country = countries?.find((c: any) => c.nicename === countryValue);
                    
                    if (!country) return false;
                    
                    // Search by nicename, name, iso, iso3, or nationality
                    return (
                        country.nicename?.toLowerCase().includes(searchText) ||
                        country.name?.toLowerCase().includes(searchText) ||
                        country.iso?.toLowerCase().includes(searchText) ||
                        country.iso3?.toLowerCase().includes(searchText) ||
                        country.nationality?.toLowerCase().includes(searchText)
                    );
                }}
            >
                {countries && countries.length > 0 ? (
                    countries.map((country: any) => (
                        <Select.Option key={country.iso || country.id} value={country.nicename}>
                            <span className="flex items-center gap-2">
                                <span className={`flag-icon flag-icon-${country.iso?.toLowerCase()} mr-1`} />
                                {country.nicename}
                                {country.nationality && country.nationality !== 'unknown' && (
                                    <span className="text-gray-500 text-xs">
                                        ({country.nationality})
                                    </span>
                                )}
                            </span>
                        </Select.Option>
                    ))
                ) : (
                    <Select.Option disabled value="">
                        No countries available
                    </Select.Option>
                )}
            </Select>
        </Form.Item>
    );

    const renderCurrencyField = (field: CustomField) => (
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
            <CurrencyInput
                placeholder={`Enter ${field.label}`}
                noFormItem={true}
                disabled={false}
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
            case 'country':
                return renderCountryField(field);
            case 'currency':
                return renderCurrencyField(field);
            case 'repeatable':
                return (
                    <RepeatableFieldRenderer
                        key={field.id}
                        field={field as any}
                        form={form}
                        namePrefix={namePrefix}
                        errors={{}}
                        isFieldVisible={isFieldVisible}
                    />
                );
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
                    <Col key={field.id} span={field.type === 'textarea' || field.type === 'repeatable' ? 24 : 12}>
                        {fieldElement}
                    </Col>
                );
            })}
        </Row>
    );
};

export default CustomFieldRenderer;