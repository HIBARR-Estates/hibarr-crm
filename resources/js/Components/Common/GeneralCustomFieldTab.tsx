import React, { useState } from "react";
import {
    Form,
    Input,
    Select,
    DatePicker,
    Checkbox,
    Radio,
    Row,
    Col,
    InputNumber,
    Upload,
    Button,
} from "antd";
import PhoneInput from "antd-phone-input";
import { UploadOutlined } from "@ant-design/icons";
import { usePage } from "@inertiajs/react";
import { useCustomFieldVisibility } from "@/Hooks/useCustomFieldVisibility";
import CurrencyInput from "@/Components/CurrencyInput";
import RepeatableFieldRenderer from "@/Components/RepeatableFieldRenderer";
import { useCountries } from "@/Hooks/useFormData";

interface CustomFieldTabProps<CustomFormData = any> {
    data: CustomFormData;
    setData: (key: keyof CustomFormData, value: any) => void;
    errors: Record<string, string>;
    categoryId: number;
    categoryName: string;
    customFields?: any[];
    dealCustomFields?: any[];
}

const GeneralCustomFieldTab = <
    T extends { custom_fields_data?: Record<string, any> } = any
>({
    data,
    setData,
    errors,
    categoryId,
    categoryName,
    customFields: customFieldsOverride,
    dealCustomFields: dealCustomFieldsOverride,
}: CustomFieldTabProps<T>) => {
    const { props } = usePage<any>();
    const { countries } = useCountries();
    const customFields = customFieldsOverride ?? props.customFields ?? [];
    const dealCustomFields =
        dealCustomFieldsOverride ?? props.dealCustomFields ?? [];

    // Get form instance from parent Form context (may be null if no Form context)
    // Call hook once at top level to comply with Rules of Hooks
    const form = Form.useFormInstance();
    const watchedCustomFieldsData = Form.useWatch("custom_fields_data", form);
    const currentCustomFieldsData =
        watchedCustomFieldsData || data?.custom_fields_data || {};

    const [otherValues, setOtherValues] = useState<Record<string, string>>({});
    
    // Get all fields (including those from other categories) for visibility evaluation
    const allFields = customFields.concat(dealCustomFields).filter(
        (field: any, index: number, self: any[]) =>
            index === self.findIndex((f) => f.id === field.id)
    );
    
    // Use visibility hook (form may be null, hook handles this gracefully)
    const { isFieldVisible } = useCustomFieldVisibility({
        fields: allFields,
        form: form || undefined, // Convert null to undefined for type safety
        namePrefix: 'custom_fields_data',
    });

    // Filter fields for this category and sort by display_order, then by ID
    const categoryFields =
        customFields
            .concat(dealCustomFields)
            //remove duplicates based on id
            ?.filter(
                (field: any, index: number, self: any[]) =>
                    index === self.findIndex((f) => f.id === field.id) //TODO: THis is a hack, fix properly later as the dealCustomFields is supposed to be properly differitaed in controller, and controller adapt the service pattern as oppososed to traits that are leading to the current override
            )
            ?.filter(
                (field: any) => field.custom_field_category_id === categoryId
            )
            .sort((a: any, b: any) => {
                // First sort by display_order if available
                const orderA = a.display_order ?? 0;
                const orderB = b.display_order ?? 0;
                
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                
                // If display_order is the same or not set, sort by ID
                return a.id - b.id;
            }) || [];

    const renderTextField = (field: any) => (
        <Form.Item
            label={field.label}
            rules={[
                {
                    required: field.required === "yes" && isFieldVisible(field.id),
                    message: `Please enter ${field.label}`,
                },
            ]}
            validateStatus={
                errors[`custom_fields_data.field_${field.id}`] ? "error" : ""
            }
            help={errors[`custom_fields_data.field_${field.id}`]}
            name={[`custom_fields_data`, `field_${field.id}`]}
        >
            <Input placeholder={field.label} />
        </Form.Item>
    );

    const renderNumberField = (field: any) => (
        <Form.Item
            label={field.label}
            validateStatus={
                errors[`custom_fields_data.field_${field.id}`] ? "error" : ""
            }
            help={errors[`custom_fields_data.field_${field.id}`]}
            name={[`custom_fields_data`, `field_${field.id}`]}
            rules={[
                {
                    required: field.required === "yes" && isFieldVisible(field.id),
                    message: `Please enter ${field.label}`,
                },
            ]}
        >
            <InputNumber
                placeholder={field.label}
                style={{ width: "100%" }}
                parser={(value) => {
                    const num = parseFloat(
                        value?.replace(/\$\s?|(,*)/g, "") || "0"
                    );
                    return num as any;
                }}
            />
        </Form.Item>
    );

    const renderTextAreaField = (field: any) => (
        <Form.Item
            label={field.label}
            validateStatus={
                errors[`custom_fields_data.field_${field.id}`] ? "error" : ""
            }
            help={errors[`custom_fields_data.field_${field.id}`]}
            name={[`custom_fields_data`, `field_${field.id}`]}
            rules={[
                {
                    required: field.required === "yes" && isFieldVisible(field.id),
                    message: `Please enter ${field.label}`,
                },
            ]}
        >
            <Input.TextArea placeholder={field.label} rows={3} />
        </Form.Item>
    );

    const renderSelectField = (field: any) => {
        const values =
            typeof field.values === "string"
                ? JSON.parse(field.values)
                : field.values;
        const hasOtherOption = values?.some(
            (v: string) => v.toLowerCase() === "other"
        );

        return (
            <Form.Item
                label={field.label}
                validateStatus={
                    errors[`custom_fields_data.field_${field.id}`]
                        ? "error"
                        : ""
                }
                help={errors[`custom_fields_data.field_${field.id}`]}
                name={[`custom_fields_data`, `field_${field.id}`]}
                rules={[
                    {
                        required: field.required === "yes" && isFieldVisible(field.id),
                        message: `Please enter ${field.label}`,
                    },
                ]}
            >
                <Select placeholder={`Select ${field.label}`} allowClear>
                    {values?.map((value: string, index: number) => (
                        <Select.Option key={index} value={value}>
                            {value}
                        </Select.Option>
                    ))}
                </Select>
            </Form.Item>
        );
    };

    const renderRadioField = (field: any) => {
        const values =
            typeof field.values === "string"
                ? JSON.parse(field.values)
                : field.values;
        const hasOtherOption = values?.some(
            (v: string) => v.toLowerCase() === "other"
        );

        return (
            <Form.Item
                label={field.label}
                validateStatus={
                    errors[`custom_fields_data.field_${field.id}`]
                        ? "error"
                        : ""
                }
                help={errors[`custom_fields_data.field_${field.id}`]}
                name={[`custom_fields_data`, `field_${field.id}`]}
                rules={[
                    {
                        required: field.required === "yes" && isFieldVisible(field.id),
                        message: `Please enter ${field.label}`,
                    },
                ]}
            >
                <Radio.Group>
                    <div className="flex gap-4 flex-wrap">
                        {values?.map((value: string, index: number) => (
                            <Radio key={index} value={value}>
                                {value}
                            </Radio>
                        ))}
                    </div>
                </Radio.Group>
            </Form.Item>
        );
    };

    const renderCheckboxField = (field: any) => {
        const values =
            typeof field.values === "string"
                ? JSON.parse(field.values)
                : field.values;
        const hasOtherOption = values?.some(
            (v: string) => v.toLowerCase() === "other"
        );

        return (
            <Form.Item
                label={field.label}
                name={[`custom_fields_data`, `field_${field.id}`]}
                validateStatus={
                    errors[`custom_fields_data.field_${field.id}`]
                        ? "error"
                        : ""
                }
                help={errors[`custom_fields_data.field_${field.id}`]}
                rules={[
                    {
                        required: field.required === "yes" && isFieldVisible(field.id),
                        message: `Please enter ${field.label}`,
                    },
                ]}
            >
                <Checkbox.Group>
                    <div className="flex gap-4 flex-wrap">
                        {values?.map((value: string, index: number) => (
                            <Checkbox key={index} value={value}>
                                {value}
                            </Checkbox>
                        ))}
                    </div>
                </Checkbox.Group>
            </Form.Item>
        );
    };

    const renderDateField = (field: any) => (
        <Form.Item
            label={field.label}
            validateStatus={
                errors[`custom_fields_data.field_${field.id}`] ? "error" : ""
            }
            help={errors[`custom_fields_data.field_${field.id}`]}
            name={[`custom_fields_data`, `field_${field.id}`]}
            rules={[
                {
                    required: field.required === "yes" && isFieldVisible(field.id),
                    message: `Please enter ${field.label}`,
                },
            ]}
        >
            <DatePicker
                placeholder={`Select ${field.label}`}
                style={{ width: "100%" }}
            />
        </Form.Item>
    );

    const renderCurrencyField = (field: any) => (
        <Form.Item
            label={field.label}
            validateStatus={
                errors[`custom_fields_data.field_${field.id}`] ? "error" : ""
            }
            help={errors[`custom_fields_data.field_${field.id}`]}
            name={[`custom_fields_data`, `field_${field.id}`]}
            rules={[
                {
                    required: field.required === "yes" && isFieldVisible(field.id),
                    message: `Please enter ${field.label}`,
                },
            ]}
        >
            <CurrencyInput
                placeholder={`Enter ${field.label}`}
                showLabel={false}
                noFormItem={true}
                disabled={false}
            />
        </Form.Item>
    );

    const renderCountryField = (field: any) => {
        // Debug: Log if countries are missing
        if (!countries || countries.length === 0) {
            console.warn('Countries not loaded for country field:', field.label);
        }

        return (
            <Form.Item
                label={field.label}
                validateStatus={
                    errors[`custom_fields_data.field_${field.id}`] ? "error" : ""
                }
                help={errors[`custom_fields_data.field_${field.id}`]}
                name={[`custom_fields_data`, `field_${field.id}`]}
                rules={[
                    {
                        required: field.required === "yes" && isFieldVisible(field.id),
                        message: `Please enter ${field.label}`,
                    },
                ]}
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
                    notFoundContent={
                        !countries || countries.length === 0 
                            ? "Countries not available" 
                            : "No countries found"
                    }
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
    };

    const renderPhoneField = (field: any) => (
        <Form.Item
            label={field.label}
            validateStatus={
                errors[`custom_fields_data.field_${field.id}`] ? "error" : ""
            }
            help={errors[`custom_fields_data.field_${field.id}`]}
            name={[`custom_fields_data`, `field_${field.id}`]}
            rules={[
                {
                    required: field.required === "yes" && isFieldVisible(field.id),
                    message: `Please enter ${field.label}`,
                },
            ]}
        >
            <PhoneInput 
                enableSearch 
                placeholder={field.label}
                country=""
            />
        </Form.Item>
    );

    const renderFileField = (field: any) => (
        <Form.Item
            label={field.label}
            validateStatus={
                errors[`custom_fields_data.field_${field.id}`] ? "error" : ""
            }
            help={errors[`custom_fields_data.field_${field.id}`]}
            name={[`custom_fields_data`, `field_${field.id}`]}
            valuePropName="fileList"
            getValueFromEvent={(e: any) => {
                if (Array.isArray(e)) {
                    return e;
                }
                return e?.fileList;
            }}
            rules={[
                {
                    required: field.required === "yes" && isFieldVisible(field.id),
                    message: `Please upload ${field.label}`,
                },
            ]}
        >
            <Upload beforeUpload={() => false} maxCount={1}>
                <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
        </Form.Item>
    );

    const renderRepeatableField = (field: any) => (
        <RepeatableFieldRenderer
            field={field}
            form={form}
            namePrefix="custom_fields_data"
            errors={errors}
            isFieldVisible={isFieldVisible}
            currentCustomFieldsData={currentCustomFieldsData}
        />
    );

    const renderField = (field: any) => {
        // Check visibility - if field is not visible, don't render it
        if (!isFieldVisible(field.id)) {
            return null;
        }
        
        switch (field.type) {
            case "text":
                return renderTextField(field);
            case "number":
                return renderNumberField(field);
            case "textarea":
                return renderTextAreaField(field);
            case "select":
                return renderSelectField(field);
            case "radio":
                return renderRadioField(field);
            case "checkbox":
                return renderCheckboxField(field);
            case "date":
                return renderDateField(field);
            case "country":
                return renderCountryField(field);
            case "currency":
                return renderCurrencyField(field);
            case "phone":
                return renderPhoneField(field);
            case "file":
                return renderFileField(field);
            case "repeatable":
                return renderRepeatableField(field);
            default:
                return renderTextField(field);
        }
    };

    if (categoryFields.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No custom fields available for {categoryName}
            </div>
        );
    }

    // Filter out hidden fields before rendering to avoid layout issues
    const visibleFields = categoryFields.filter((field: any) => isFieldVisible(field.id));

    return (
        <div className="space-y-6">
            <Row gutter={[24, 16]}>
                {visibleFields.map((field: any) => {
                    const fieldElement = renderField(field);
                    if (!fieldElement) return null;
                    
                    return (
                        <Col span={determineSpan(field.type)} key={field.id}>
                            {fieldElement}
                        </Col>
                    );
                })}
            </Row>
        </div>
    );
};

const determineSpan = (type: string): number => {
    switch (type) {
        case "text":
            return 24;
        case "textarea":
            return 24;
        case "select":
            return 12;
        case "radio":
            return 24;
        case "checkbox":
            return 24;
        case "file":
            return 24;
        case "currency":
            return 24;
        case "repeatable":
            return 24;
        default:
            return 12;
    }
};

export default GeneralCustomFieldTab;
