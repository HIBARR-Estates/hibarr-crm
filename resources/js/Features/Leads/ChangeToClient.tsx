import React, { useState, useEffect, useMemo } from "react";
import {
    Drawer,
    Typography,
    Form,
    Row,
    Col,
    Input,
    Select,
    Button,
    Space,
    Tabs,
    Card,
    Alert,
    App,
    Switch,
} from "antd";
import { Lead, Country, ClientCategory, Salutation, Language } from "@/Types";
import { IModalProps } from "@/Types/common";
import { router, usePage } from "@inertiajs/react";
import PhoneInput from "antd-phone-input";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import GeneralCustomFieldTab from "@/Components/Common/GeneralCustomFieldTab";
import { isLoading as _isLoading } from "@/lib/utils";
import FormDataSelector from "@/Components/FormDataSelector";
import { errorFormatter } from "@/lib/api/utils/common";
import { FormDataType, useCountries, useFormDataBatch } from "@/Hooks/useFormData";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface Props extends IModalProps {
    lead?: Lead;
}

interface ClientFormData {
    name: string;
    email: string;
    mobile?: string | any; // Can be string or phone object
    company_name?: string;
    website?: string;
    address?: string;
    note?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: number;
    category_id?: number;
    salutation?: string;
    login?: string;
    locale?: string;
    email_notifications?: number;
    password?: string;
    gender?: string;
    office?: string | any; // Can be string or phone object
    country_phonecode_mobile?: string;
    country_identifier_mobile?: string;
    country_phonecode_office?: string;
    country_identifier_office?: string;
    custom_fields_data?: Record<string, any>;
    lead?: number; // for lead conversion
}

interface ClientResponse {
    message: string;
    data?: any;
}

const ChangeToClient: React.FC<Props> = ({ lead, open, onClose }) => {
    const { td } = useTd();
    const { props } = usePage();
    const { countries } = useCountries();
    const {
        categories = [],
        salutations = [],
        languages = [],
    } = props;
    const { message: messageApi } = App.useApp();

    // S2: Index no longer ships custom field defs — fetch on open (same pattern as M2)
    const customFieldTypes = useMemo(
        () =>
            [
                "lead-custom-fields",
                "lead-custom-field-categories",
            ] as FormDataType[],
        [],
    );
    const { data: fetchedFormData } = useFormDataBatch(customFieldTypes, {
        enabled: open,
    });
    const pickFetchedArray = (type: string, fallback: any[] = []) => {
        const value = fetchedFormData[type];
        return Array.isArray(value) && value.length > 0 ? value : fallback;
    };
    const customFields = pickFetchedArray(
        "lead-custom-fields",
        (props as any).leadCustomFields || (props as any).customFields || [],
    );
    const customFieldCategories = pickFetchedArray(
        "lead-custom-field-categories",
        (props as any).leadCustomFieldCategories ||
            (props as any).customFieldCategories ||
            [],
    );

    const [form] = Form.useForm();
    const [activeTab, setActiveTab] = useState("account");
    const [errors, setErrors] = useState<string[]>([]);

    const clientMutation = useApiMutate<
        ClientFormData,
        ClientResponse,
        ApiResponse<ClientResponse>
    >(route("clients.store"), "POST", (response) => {
        if (response?.status === "success") {
            messageApi.success("Lead successfully converted to client!");
            form.resetFields();
            onClose();
            router.reload();
        }
    });

    useEffect(() => {
        if (open && lead) {
            // Pre-fill form with lead data
            form.setFieldsValue({
                gender: lead?.gender || lead?.gender_value,
                salutation: lead?.salutation || lead?.salutation_value,
                name: lead.client_name,
                email: lead.client_email,
                mobile: lead.mobile,
                company_name: lead.company_name,
                website: lead.website,
                address: lead.address,
                note: lead.note,
                city: lead.city,
                state: lead.state,
                postal_code: lead.postal_code,
                country: lead.country,
                login: "disable", // Default to disabled login
                email_notifications: 1,
                locale: "en",
            });
        }
    }, [open, lead, form]);

    const handleCancel = () => {
        form.resetFields();
        setErrors([]);
        onClose();
    };

    const handleSubmit = (values: ClientFormData) => {
        console.log(values, "TTTTTT.....");
        setErrors([]);

        // Handle phone data transformation
        const handlePhoneData = (phoneField: any) => {
            if (!phoneField)
                return { phone: "", country_code: "", country_identifier: "" };

            if (typeof phoneField === "object" && phoneField.phone) {
                // Already in the correct format
                return {
                    phone: phoneField.phone,
                    country_code: phoneField.country_code,
                    country_identifier: phoneField.country_identifier,
                };
            } else if (typeof phoneField === "string") {
                // Convert string to JSON format if needed
                return {
                    phone: phoneField,
                    country_code: "",
                    country_identifier: "",
                };
            }
            return { phone: "", country_code: "", country_identifier: "" };
        };

        const mobileData = handlePhoneData(values.mobile);
        const officeData = handlePhoneData(values.office);

        const requestData: ClientFormData = {
            name: values.name || "",
            email: values.email || "",
            login: values.login || "disable",
            locale: values.locale || "en",
            email_notifications: values.email_notifications ? 1 : 0,
            company_name: values.company_name || "",
            website: values.website || "",
            address: values.address || "",
            city: values.city || "",
            state: values.state || "",
            postal_code: values.postal_code || "",
            // Send mobile as JSON string if we have proper data
            mobile: mobileData.phone ? JSON.stringify(mobileData) : "",
            // Send office as JSON string if we have proper data
            office: officeData.phone ? JSON.stringify(officeData) : "",
            country: values.country,
            category_id: values.category_id,
            salutation: values.salutation || "",
            note: values.note || "",
            password: values.password || "",
            gender: values.gender || "",
            // Include the separate fields for backward compatibility
            country_phonecode_mobile: mobileData.country_code,
            country_identifier_mobile: mobileData.country_identifier,
            country_phonecode_office: officeData.country_code,
            country_identifier_office: officeData.country_identifier,
            // Custom fields data
            custom_fields_data: values.custom_fields_data || {},
            // Mark as conversion from lead
            lead: lead?.id,
        };

        clientMutation.mutate(requestData, {
            onError: (errorResponse) => {
                const responseErrors =
                    errorFormatter(errorResponse)?.errors || [];
                setErrors((prev) => [
                    ...prev,
                    ...Object.values(responseErrors).flat(),
                ]);
            },
        });
    };

    const handleErrorsClear = () => {
        setErrors([]);
    };

    const isLoading = _isLoading({ status: clientMutation.status });

    const accountTab = (
        <div className="flex flex-col gap-y-4">
            {/* Display errors */}
            {errors.length > 0 && (
                <div className="mb-4">
                    <Alert
                        message={td("Validation Error", { source: "en" })}
                        description={
                            <ul className="mb-0">
                                {errors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        }
                        type="error"
                        showIcon
                        closable
                        onClose={handleErrorsClear}
                    />
                </div>
            )}

            <Card size="small" title={td("Basic Information", { source: "en" })} className="mb-4">
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="salutation" label={td("Salutation", { source: "en" })}>
                            <FormDataSelector
                                type="salutations"
                                placeholder={td("Salutation", { source: "en" })}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="name"
                            label={td("Name", { source: "en" })}
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter name",
                                },
                            ]}
                        >
                            <Input placeholder={td("Enter full name", { source: "en" })} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="email"
                            label={td("Email", { source: "en" })}
                            rules={[
                                {
                                    type: "email",
                                    message: "Please enter a valid email",
                                },
                                {
                                    required:
                                        form.getFieldValue("login") ===
                                        "enable",
                                    message:
                                        "Email is required when login is enabled",
                                },
                            ]}
                        >
                            <Input placeholder={td("Enter email address", { source: "en" })} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="mobile" label={td("Mobile", { source: "en" })}>
                            <PhoneInput 
                                enableSearch 
                                placeholder={td("Enter mobile number", { source: "en" })}
                                onChange={(value) => {
                                    if (value && typeof value === 'object') {
                                        form.setFieldValue('mobile', {
                                            phone: value.phoneNumber || '',
                                            country_code: value.countryCode || '',
                                            country_identifier: value.isoCode || ''
                                        });
                                    }
                                }}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="gender" label={td("Gender", { source: "en" })}>
                            <FormDataSelector
                                type="genders"
                                placeholder={td("Gender", { source: "en" })}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="category_id" label={td("Category", { source: "en" })}>
                            <FormDataSelector
                                type="categories"
                                placeholder={td("Category", { source: "en" })}
                            />
                        </Form.Item>
                    </Col>
                </Row>
            </Card>

            <Card size="small" title={td("Login Settings", { source: "en" })} className="mb-4">
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="login"
                            label={td("Login Access", { source: "en" })}
                            initialValue="disable"
                        >
                            <Select>
                                <Option value="enable">{td("Enable", { source: "en" })}</Option>
                                <Option value="disable">{td("Disable", { source: "en" })}</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="locale" label={td("Language", { source: "en" })}>
                            <FormDataSelector
                                type="languages"
                                placeholder={td("Language", { source: "en" })}
                            />
                            {/* <Select>
                                {languages?.map((lang) => (
                                    <Option
                                        key={lang.language_code}
                                        value={lang.language_code}
                                    >
                                        {lang.language_name}
                                    </Option>
                                ))}
                            </Select> */}
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                        prevValues.login !== currentValues.login
                    }
                >
                    {({ getFieldValue }) =>
                        getFieldValue("login") === "enable" ? (
                            <Form.Item
                                name="password"
                                label={td("Password", { source: "en" })}
                                rules={[
                                    {
                                        required: true,
                                        message: "Please enter password",
                                    },
                                    {
                                        min: 8,
                                        message:
                                            "Password must be at least 8 characters",
                                    },
                                ]}
                            >
                                <Input.Password placeholder={td("Enter password (min 8 characters)", { source: "en" })} />
                            </Form.Item>
                        ) : null
                    }
                </Form.Item>
            </Card>
        </div>
    );

    const companyTab = (
        <div className="flex flex-col gap-y-4">
            <Card size="small" title={td("Company Information", { source: "en" })}>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="company_name" label={td("Company Name", { source: "en" })}>
                            <Input placeholder={td("Enter company name", { source: "en" })} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="website"
                            label={td("Website", { source: "en" })}
                            rules={[
                                {
                                    type: "url",
                                    message:
                                        "Please enter a valid URL with http:// or https://",
                                },
                            ]}
                        >
                            <Input placeholder="https://example.com" />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name="address" label={td("Address", { source: "en" })}>
                    <TextArea rows={3} placeholder={td("Enter company address", { source: "en" })} />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="city" label={td("City", { source: "en" })}>
                            <Input placeholder={td("Enter city", { source: "en" })} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="state" label={td("State/Province", { source: "en" })}>
                            <Input placeholder={td("Enter state", { source: "en" })} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="postal_code" label={td("Postal Code", { source: "en" })}>
                            <Input placeholder={td("Enter postal code", { source: "en" })} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name="country" label={td("Country", { source: "en" })}>
                    <FormDataSelector type="countries" placeholder={td("Country", { source: "en" })} />
                    {/* <Select
                        placeholder="Select country"
                        allowClear
                        showSearch
                        filterOption={(input, option) =>
                            String(option?.children || "")
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                    >
                        {countries.map((country) => (
                            <Option key={country.id} value={country.id}>
                                {country.nicename}
                            </Option>
                        ))}
                    </Select> */}
                </Form.Item>

                <Form.Item name="office" label={td("Office Phone", { source: "en" })}>
                    <PhoneInput 
                        enableSearch 
                        placeholder={td("Enter office phone number", { source: "en" })}
                        onChange={(value) => {
                            if (value && typeof value === 'object') {
                                form.setFieldValue('office', {
                                    phone: value.phoneNumber || '',
                                    country_code: value.countryCode || '',
                                    country_identifier: value.isoCode || ''
                                });
                            }
                        }}
                    />
                </Form.Item>
            </Card>
        </div>
    );

    const noteTab = (
        <Card size="small" title={td("Additional Notes", { source: "en" })}>
            <Form.Item name="note" label={td("Notes", { source: "en" })}>
                <TextArea
                    rows={6}
                    placeholder={td("Enter any additional notes about the client...", { source: "en" })}
                />
            </Form.Item>
        </Card>
    );

    const tabItems = [
        {
            key: "account",
            label: td("Account Details", { source: "en" }),
            children: accountTab,
        },
        {
            key: "company",
            label: td("Company Details", { source: "en" }),
            children: companyTab,
        },
        {
            key: "notes",
            label: td("Notes", { source: "en" }),
            children: noteTab,
        },
        // Add custom field category tabs
        ...(customFieldCategories && Array.isArray(customFieldCategories)
            ? customFieldCategories.map((category: any) => ({
                  key: `custom_${category.id}`,
                  label: category.name,
                  children: (
                      <Card
                          size="small"
                          title={`${category.name} Custom Fields`}
                      >
                          <GeneralCustomFieldTab
                              data={{
                                  custom_fields_data:
                                      form.getFieldsValue()
                                          .custom_fields_data || {},
                              }}
                              setData={(key, value) => {
                                  if (key === "custom_fields_data") {
                                      form.setFieldsValue({ [key]: value });
                                  }
                              }}
                              errors={{}}
                              categoryId={category.id}
                              categoryName={category.name}
                              customFields={customFields}
                          />
                      </Card>
                  ),
              }))
            : []),
    ];

    return (
        <Drawer
            title={`Convert Lead to Client`}
            open={open}
            onClose={handleCancel}
            width={800}
            footer={
                <div className="flex justify-end space-x-2">
                    <Button onClick={handleCancel}>{td("Cancel", { source: "en" })}</Button>
                    <Button
                        type="primary"
                        onClick={() => form.submit()}
                        loading={isLoading}
                    >
                        {td("Convert to Client", { source: "en" })}
                    </Button>
                </div>
            }
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                className="space-y-4"
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    className="lead-conversion-tabs"
                />
            </Form>
        </Drawer>
    );
};

export default ChangeToClient;
