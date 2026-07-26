import React, { useMemo, useState } from "react";
import {
    Form,
    Input,
    Select,
    DatePicker,
    Checkbox,
    Radio,
    Row,
    Col,
    Upload,
    Button,
    message,
    Progress,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import PhoneInput from "antd-phone-input";
import { CustomField } from "@/Types";
import { useCustomFieldVisibility } from "@/Hooks/useCustomFieldVisibility";
import CurrencyInput from "@/Components/CurrencyInput";
import RangeInput from "@/Components/RangeInput";
import CurrencyRangeInput from "@/Components/CurrencyRangeInput";
import RepeatableFieldRenderer from "@/Components/RepeatableFieldRenderer";
import { getFileUploadService } from "@/Services/FileUploadService";
import { useCountries } from "@/Hooks/useFormData";

interface Props {
    fields: CustomField[];
    form: any;
    namePrefix?: string;
}

const CustomFieldRenderer: React.FC<Props> = ({
    fields,
    form,
    namePrefix = "custom_fields_data",
}) => {
    const { countries } = useCountries();

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
                field.required === "yes" && isFieldVisible(field.id)
                    ? [
                          {
                              required: true,
                              message: `${field.label} is required`,
                          },
                      ]
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
                field.required === "yes" && isFieldVisible(field.id)
                    ? [
                          {
                              required: true,
                              message: `${field.label} is required`,
                          },
                      ]
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
                field.required === "yes" && isFieldVisible(field.id)
                    ? [
                          {
                              required: true,
                              message: `${field.label} is required`,
                          },
                      ]
                    : []
            }
        >
            <Input.TextArea placeholder={`Enter ${field.label}`} rows={3} />
        </Form.Item>
    );

    const renderSelectField = (field: CustomField) => {
        const values =
            typeof field.values === "string"
                ? JSON.parse(field.values)
                : field.values || [];

        return (
            <Form.Item
                key={field.id}
                name={[namePrefix, `field_${field.id}`]}
                label={field.label}
                rules={
                    field.required === "yes" && isFieldVisible(field.id)
                        ? [
                              {
                                  required: true,
                                  message: `${field.label} is required`,
                              },
                          ]
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
        const values =
            typeof field.values === "string"
                ? JSON.parse(field.values)
                : field.values || [];

        return (
            <Form.Item
                key={field.id}
                name={[namePrefix, `field_${field.id}`]}
                label={field.label}
                rules={
                    field.required === "yes" && isFieldVisible(field.id)
                        ? [
                              {
                                  required: true,
                                  message: `${field.label} is required`,
                              },
                          ]
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
        const values =
            typeof field.values === "string"
                ? JSON.parse(field.values)
                : field.values || [];

        return (
            <Form.Item
                key={field.id}
                name={[namePrefix, `field_${field.id}`]}
                label={field.label}
                rules={
                    field.required === "yes" && isFieldVisible(field.id)
                        ? [
                              {
                                  required: true,
                                  message: `${field.label} is required`,
                              },
                          ]
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
                field.required === "yes" && isFieldVisible(field.id)
                    ? [
                          {
                              required: true,
                              message: `${field.label} is required`,
                          },
                      ]
                    : []
            }
        >
            <DatePicker
                placeholder={`Select ${field.label}`}
                style={{ width: "100%" }}
            />
        </Form.Item>
    );

    const renderCountryField = (field: CustomField) => (
        <Form.Item
            key={field.id}
            name={[namePrefix, `field_${field.id}`]}
            label={field.label}
            rules={
                field.required === "yes" && isFieldVisible(field.id)
                    ? [
                          {
                              required: true,
                              message: `${field.label} is required`,
                          },
                      ]
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
                    const country = countries?.find(
                        (c: any) => c.nicename === countryValue,
                    );

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
                        <Select.Option
                            key={country.iso || country.id}
                            value={country.nicename}
                        >
                            <span className="flex items-center gap-2">
                                <span
                                    className={`flag-icon flag-icon-${country.iso?.toLowerCase()} mr-1`}
                                />
                                {country.nicename}
                                {country.nationality &&
                                    country.nationality !== "unknown" && (
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

    const renderMultiSelectCountryField = (field: CustomField) => (
        <Form.Item
            key={field.id}
            name={[namePrefix, `field_${field.id}`]}
            label={field.label}
            rules={
                field.required === "yes" && isFieldVisible(field.id)
                    ? [
                          {
                              required: true,
                              message: `${field.label} is required`,
                          },
                      ]
                    : []
            }
        >
            <Select
                mode="multiple"
                placeholder={`Select ${field.label}`}
                allowClear
                showSearch
                filterOption={(input, option) => {
                    const searchText = input.toLowerCase();
                    const countryValue = option?.value as string;
                    const country = countries?.find(
                        (c: any) => c.nicename === countryValue,
                    );

                    if (!country) return false;

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
                        <Select.Option
                            key={country.iso || country.id}
                            value={country.nicename}
                        >
                            <span className="flex items-center gap-2">
                                <span
                                    className={`flag-icon flag-icon-${country.iso?.toLowerCase()} mr-1`}
                                />
                                {country.nicename}
                                {country.nationality &&
                                    country.nationality !== "unknown" && (
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
                field.required === "yes" && isFieldVisible(field.id)
                    ? [
                          {
                              required: true,
                              message: `${field.label} is required`,
                          },
                      ]
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

    const renderRangeField = (field: CustomField) => (
        <Form.Item
            key={field.id}
            name={[namePrefix, `field_${field.id}`]}
            label={field.label}
            rules={
                field.required === "yes" && isFieldVisible(field.id)
                    ? [
                          {
                              required: true,
                              message: `${field.label} is required`,
                          },
                      ]
                    : []
            }
        >
            <RangeInput placeholder={field.label} />
        </Form.Item>
    );

    const renderCurrencyRangeField = (field: CustomField) => (
        <Form.Item
            key={field.id}
            name={[namePrefix, `field_${field.id}`]}
            label={field.label}
            rules={
                field.required === "yes" && isFieldVisible(field.id)
                    ? [
                          {
                              required: true,
                              message: `${field.label} is required`,
                          },
                      ]
                    : []
            }
        >
            <CurrencyRangeInput placeholder={field.label} />
        </Form.Item>
    );

    // File upload field using external FileUploadService
    const FileUploadField: React.FC<{ field: CustomField }> = ({ field }) => {
        const [uploading, setUploading] = useState(false);
        const [uploadProgress, setUploadProgress] = useState(0);

        const handleBeforeUpload = async (file: File) => {
            setUploading(true);
            setUploadProgress(0);
            try {
                const service = getFileUploadService();
                const result = await service.uploadSingle(
                    file,
                    "custom_fields",
                    (_fileId, progress) => setUploadProgress(progress),
                );
                // Set the form field value to the download URL
                form.setFieldValue(
                    [namePrefix, `field_${field.id}`],
                    result.downloadUrl,
                );
                message.success("File uploaded successfully");
            } catch (error) {
                console.error("File upload failed:", error);
                message.error("Failed to upload file");
            } finally {
                setUploading(false);
                setUploadProgress(0);
            }
            return false; // Prevent default upload
        };

        const currentValue = form.getFieldValue([
            namePrefix,
            `field_${field.id}`,
        ]);

        return (
            <Form.Item
                key={field.id}
                name={[namePrefix, `field_${field.id}`]}
                label={field.label}
                rules={
                    field.required === "yes" && isFieldVisible(field.id)
                        ? [
                              {
                                  required: true,
                                  message: `${field.label} is required`,
                              },
                          ]
                        : []
                }
            >
                <div>
                    {uploading && uploadProgress > 0 ? (
                        <Progress
                            percent={uploadProgress}
                            size="small"
                            status="active"
                        />
                    ) : (
                        <Upload
                            beforeUpload={handleBeforeUpload}
                            showUploadList={false}
                            accept="*/*"
                            maxCount={1}
                        >
                            <Button
                                icon={<UploadOutlined />}
                                loading={uploading}
                            >
                                {currentValue ? "Replace File" : "Upload File"}
                            </Button>
                        </Upload>
                    )}
                    {currentValue && !uploading && (
                        <div className="mt-1 text-sm text-gray-500 truncate max-w-[250px]">
                            {typeof currentValue === "string" &&
                            currentValue.startsWith("http")
                                ? decodeURIComponent(
                                      currentValue.split("/").pop() ||
                                          "Uploaded file",
                                  )
                                : currentValue}
                        </div>
                    )}
                </div>
            </Form.Item>
        );
    };

    const renderField = (field: CustomField) => {
        // Check visibility
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
            case "multiSelectCountry":
                return renderMultiSelectCountryField(field);
            case "currency":
                return renderCurrencyField(field);
            case "range":
                return renderRangeField(field);
            case "currency_range":
                return renderCurrencyRangeField(field);
            case "repeatable":
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
            case "file":
                return <FileUploadField key={field.id} field={field} />;
            default:
                return renderTextField(field);
        }
    };

    return (
        <Row gutter={[16, 16]}>
            {sortedFields.map((field) => {
                const fieldElement = renderField(field);
                if (!fieldElement) return null;

                return (
                    <Col
                        key={field.id}
                        span={
                            field.type === "textarea" ||
                            field.type === "repeatable" ||
                            field.type === "currency_range"
                                ? 24
                                : 12
                        }
                    >
                        {fieldElement}
                    </Col>
                );
            })}
        </Row>
    );
};

export default CustomFieldRenderer;
