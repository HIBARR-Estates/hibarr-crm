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

    const [otherValues, setOtherValues] = useState<Record<string, string>>({});

    // Filter fields for this category and sort by field type
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
                // Define the order priority for field types
                const typeOrder = {
                    select: 1,
                    text: 2,
                    textarea: 3,
                    radio: 4,
                    checkbox: 5,
                    number: 0, // Same priority as text
                    date: 2, // Same priority as text
                    country: 1, // Same priority as select
                    phone: 2, // Same priority as text
                    file: 3, // Same priority as textarea
                };

                const aOrder = typeOrder[a.type as keyof typeof typeOrder] || 6;
                const bOrder = typeOrder[b.type as keyof typeof typeOrder] || 6;

                return aOrder - bOrder;
            }) || [];

    const renderTextField = (field: any) => (
        <Form.Item
            label={field.label}
            rules={[
                {
                    required: field.required === "yes",
                    message: `Please enter ${field.label}`,
                },
            ]}
            validateStatus={
                errors[`custom_fields_data.field_${field.id}`] ? "error" : ""
            }
            help={errors[`custom_fields_data.field_${field.id}`]}
            name={[`custom_fields_data`, `${field.name}_${field.id}`]}
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
            name={[`custom_fields_data`, `${field.name}_${field.id}`]}
            rules={[
                {
                    required: field.required === "yes",
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
            name={[`custom_fields_data`, `${field.name}_${field.id}`]}
            rules={[
                {
                    required: field.required === "yes",
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
                name={[`custom_fields_data`, `${field.name}_${field.id}`]}
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
                name={[`custom_fields_data`, `${field.name}_${field.id}`]}
                rules={[
                    {
                        required: field.required === "yes",
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
                name={[`custom_fields_data`, `${field.name}_${field.id}`]}
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
            name={[`custom_fields_data`, `${field.name}_${field.id}`]}
            rules={[
                {
                    required: field.required === "yes",
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
            name={[`custom_fields_data`, `${field.name}_${field.id}`]}
            rules={[
                {
                    required: field.required === "yes",
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
            name={[`custom_fields_data`, `${field.name}_${field.id}`]}
            rules={[
                {
                    required: field.required === "yes",
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
            name={[`custom_fields_data`, `${field.name}_${field.id}`]}
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

    return (
        <div className="space-y-6">
            <Row gutter={[24, 16]}>
                {categoryFields.map((field: any) => (
                    <Col span={determineSpan(field.type)} key={field.id}>
                        {renderField(field)}
                    </Col>
                ))}
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
