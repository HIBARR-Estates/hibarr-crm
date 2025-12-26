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
import { UploadOutlined } from "@ant-design/icons";
import { usePage } from "@inertiajs/react";
import { useCustomFieldVisibility } from "@/Hooks/useCustomFieldVisibility";

interface CustomFieldTabProps<CustomFormData = any> {
    data: CustomFormData;
    setData: (key: keyof CustomFormData, value: any) => void;
    errors: Record<string, string>;
    categoryId: number;
    categoryName: string;
}

const GeneralCustomFieldTab = <
    T extends { custom_fields_data?: Record<string, any> } = any
>({
    data,
    setData,
    errors,
    categoryId,
    categoryName,
}: CustomFieldTabProps<T>) => {
    const { props } = usePage<any>();
    const { customFields = [], countries, dealCustomFields = [] } = props;

    // Get form instance and watch custom_fields_data for real-time visibility updates
    const form = Form.useFormInstance();
    const watchedCustomFieldsData = Form.useWatch("custom_fields_data", form);
    const currentCustomFieldsData =
        watchedCustomFieldsData || data?.custom_fields_data || {};

    const [otherValues, setOtherValues] = useState<Record<string, string>>({});
    
    // Get form instance from parent Form context (may be null if no Form context)
    const form = Form.useFormInstance();
    
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

    const checkVisibility = (field: any) => {
        if (
            !field.visibility ||
            !field.conditions ||
            field.conditions.length === 0
        ) {
            return true; // Visible by default if no rules
        }

        const { logic_string } = field.visibility;
        const { conditions } = field;
        const formValues = currentCustomFieldsData;

        // Evaluate each condition
        const conditionResults = conditions.map((condition: any) => {
            const targetFieldId = condition.target_field_id;
            // Find the target field definition to get its name
            const targetField = customFields
                .concat(dealCustomFields)
                .find((f: any) => f.id === targetFieldId);
            if (!targetField) return false;

            const targetKey = `${targetField.name}_${targetField.id}`;
            const targetValue = formValues[targetKey];

            switch (condition.operator) {
                case "==":
                    return targetValue == condition.value;
                case "!=":
                    return targetValue != condition.value;
                case ">":
                    return Number(targetValue) > Number(condition.value);
                case "<":
                    return Number(targetValue) < Number(condition.value);
                case "contains":
                    return String(targetValue || "").includes(condition.value);
                default:
                    return false;
            }
        });

        let evalString = logic_string;
        // Sort conditions by index descending to avoid replacing "1" in "10"
        const indices = conditions
            .map((_: any, i: number) => i + 1)
            .sort((a: number, b: number) => b - a);

        for (const index of indices) {
            const result = conditionResults[index - 1];
            evalString = evalString.replace(
                new RegExp(`\\b${index}\\b`, "g"),
                String(result)
            );
        }

        try {
            // Sanitize: ensure only allowed chars remain (true, false, space, (, ), &, |, !)
            if (!/^[truefalse\s\(\)\&\|!]+$/.test(evalString)) {
                console.error(
                    "Invalid logic string after substitution:",
                    evalString
                );
                return false;
            }

            return new Function(`return ${evalString}`)();
        } catch (e) {
            console.error("Error evaluating visibility logic:", e);
            return true; // Fallback to visible
        }
    };

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
                        required: field.required === "yes",
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
                        required: field.required === "yes",
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

    const renderCountryField = (field: any) => (
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
                // value={getFieldValue(field) || undefined}
                // onChange={(value) => setFieldValue(field, value)}
                allowClear
                showSearch
                filterOption={(input, option) =>
                    (option?.children as unknown as string)
                        ?.toLowerCase()
                        .includes(input.toLowerCase())
                }
            >
                {countries?.map((country: any) => (
                    <Select.Option key={country.iso} value={country.nicename}>
                        {country.nicename}
                    </Select.Option>
                ))}
            </Select>
        </Form.Item>
    );

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
            <Input
                placeholder={field.label}
                // value={getFieldValue(field) || ""}
                // onChange={(e) => setFieldValue(field, e.target.value)}
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
                    required: field.required === "yes",
                    message: `Please upload ${field.label}`,
                },
            ]}
        >
            <Upload beforeUpload={() => false} maxCount={1}>
                <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
        </Form.Item>
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
            case "phone":
                return renderPhoneField(field);
            case "file":
                return renderFileField(field);
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
        default:
            return 12;
    }
};

export default GeneralCustomFieldTab;
