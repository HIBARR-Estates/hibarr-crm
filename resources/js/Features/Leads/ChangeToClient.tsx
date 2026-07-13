import React, { useState, useEffect } from "react";
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
import { useCountries } from "@/Hooks/useFormData";

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
    const { props } = usePage();
    const { countries } = useCountries();
    const {
        categories = [],
        salutations = [],
        languages = [],
    } = props;
    const { message: messageApi } = App.useApp();
    const {
        props: { customFieldCategories = [], customFields = [] },
    } = usePage();
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
                        message="Validation Error"
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

            <Card size="small" title="Basic Information" className="mb-4">
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="salutation" label="Salutation">
                            <FormDataSelector
                                type="salutations"
                                placeholder="Salutation"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="name"
                            label="Name"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter name",
                                },
                            ]}
                        >
                            <Input placeholder="Enter full name" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="email"
                            label="Email"
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
                            <Input placeholder="Enter email address" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="mobile" label="Mobile">
                            <PhoneInput 
                                enableSearch 
                                placeholder="Enter mobile number"
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
                        <Form.Item name="gender" label="Gender">
                            <FormDataSelector
                                type="genders"
                                placeholder="Gender"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="category_id" label="Category">
                            <FormDataSelector
                                type="categories"
                                placeholder="Category"
                            />
                        </Form.Item>
                    </Col>
                </Row>
            </Card>

            <Card size="small" title="Login Settings" className="mb-4">
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="login"
                            label="Login Access"
                            initialValue="disable"
                        >
                            <Select>
                                <Option value="enable">Enable</Option>
                                <Option value="disable">Disable</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="locale" label="Language">
                            <FormDataSelector
                                type="languages"
                                placeholder="Language"
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
                                label="Password"
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
                                <Input.Password placeholder="Enter password (min 8 characters)" />
                            </Form.Item>
                        ) : null
                    }
                </Form.Item>
            </Card>
        </div>
    );

    const companyTab = (
        <div className="flex flex-col gap-y-4">
            <Card size="small" title="Company Information">
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="company_name" label="Company Name">
                            <Input placeholder="Enter company name" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="website"
                            label="Website"
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

                <Form.Item name="address" label="Address">
                    <TextArea rows={3} placeholder="Enter company address" />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="city" label="City">
                            <Input placeholder="Enter city" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="state" label="State/Province">
                            <Input placeholder="Enter state" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="postal_code" label="Postal Code">
                            <Input placeholder="Enter postal code" />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name="country" label="Country">
                    <FormDataSelector type="countries" placeholder="Country" />
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

                <Form.Item name="office" label="Office Phone">
                    <PhoneInput 
                        enableSearch 
                        placeholder="Enter office phone number"
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
        <Card size="small" title="Additional Notes">
            <Form.Item name="note" label="Notes">
                <TextArea
                    rows={6}
                    placeholder="Enter any additional notes about the client..."
                />
            </Form.Item>
        </Card>
    );

    const tabItems = [
        {
            key: "account",
            label: "Account Details",
            children: accountTab,
        },
        {
            key: "company",
            label: "Company Details",
            children: companyTab,
        },
        {
            key: "notes",
            label: "Notes",
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
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Button
                        type="primary"
                        onClick={() => form.submit()}
                        loading={isLoading}
                    >
                        Convert to Client
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
