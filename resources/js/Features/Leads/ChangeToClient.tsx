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
    message,
    Tabs,
    Card,
} from "antd";
import { Lead, Country, ClientCategory, Salutation, Language } from "@/Types";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import PhoneInput from "@/Components/PhoneInput";

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface Props extends IModalProps {
    lead?: Lead;
    countries?: Country[];
    categories?: ClientCategory[];
    salutations?: { value: string; label: string }[];
    languages?: Language[];
}

const ChangeToClient: React.FC<Props> = ({
    lead,
    open,
    onClose,
    countries = [],
    categories = [],
    salutations = [],
    languages = [],
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("account");

    useEffect(() => {
        if (open && lead) {
            // Pre-fill form with lead data
            form.setFieldsValue({
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
        onClose();
    };

    const handleSubmit = async (values: any) => {
        setLoading(true);

        try {
            const formData = new FormData();

            // Basic information
            formData.append("name", values.name || "");
            formData.append("email", values.email || "");
            formData.append("login", values.login || "disable");
            formData.append("locale", values.locale || "en");
            formData.append(
                "email_notifications",
                values.email_notifications ? "1" : "0"
            );

            // Company details
            formData.append("company_name", values.company_name || "");
            formData.append("website", values.website || "");
            formData.append("address", values.address || "");
            formData.append("city", values.city || "");
            formData.append("state", values.state || "");
            formData.append("postal_code", values.postal_code || "");

            // Phone numbers
            if (values.mobile) {
                formData.append("mobile", values.mobile);
                if (values.country_phonecode_mobile) {
                    formData.append(
                        "country_phonecode_mobile",
                        values.country_phonecode_mobile
                    );
                    formData.append(
                        "country_identifier_mobile",
                        values.country_identifier_mobile
                    );
                }
            }

            if (values.office) {
                formData.append("office", values.office);
                if (values.country_phonecode_office) {
                    formData.append(
                        "country_phonecode_office",
                        values.country_phonecode_office
                    );
                    formData.append(
                        "country_identifier_office",
                        values.country_identifier_office
                    );
                }
            }

            // Other fields
            if (values.country)
                formData.append("country", values.country.toString());
            if (values.category_id)
                formData.append("category_id", values.category_id.toString());
            if (values.salutation)
                formData.append("salutation", values.salutation);
            if (values.note) formData.append("note", values.note);
            if (values.password) formData.append("password", values.password);
            if (values.gender) formData.append("gender", values.gender);

            // Custom fields if present
            if (values.custom_fields_data) {
                Object.keys(values.custom_fields_data).forEach((key) => {
                    formData.append(
                        `custom_fields_data[${key}]`,
                        values.custom_fields_data[key]
                    );
                });
            }

            router.post(route("clients.store"), formData, {
                onSuccess: () => {
                    message.success("Lead successfully converted to client!");
                    handleCancel();
                },
                onError: (errors) => {
                    console.error("Conversion errors:", errors);
                    message.error(
                        "Failed to convert lead to client. Please check the form."
                    );
                },
                onFinish: () => {
                    setLoading(false);
                },
            });
        } catch (error) {
            console.error("Error converting lead to client:", error);
            message.error("An unexpected error occurred");
            setLoading(false);
        }
    };

    const accountTab = (
        <div className="space-y-4">
            <Card size="small" title="Basic Information" className="mb-4">
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="salutation" label="Salutation">
                            <Select placeholder="Select salutation" allowClear>
                                {salutations.map((sal) => (
                                    <Option key={sal.value} value={sal.value}>
                                        {sal.label}
                                    </Option>
                                ))}
                            </Select>
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
                            {countries.length > 0 ? (
                                <PhoneInput
                                    placeholder="Enter mobile number"
                                    countries={countries}
                                    fieldName="mobile"
                                />
                            ) : (
                                <Input placeholder="Enter mobile number" />
                            )}
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="gender" label="Gender">
                            <Select placeholder="Select gender" allowClear>
                                <Option value="male">Male</Option>
                                <Option value="female">Female</Option>
                                <Option value="other">Other</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="category_id" label="Category">
                            <Select placeholder="Select category" allowClear>
                                {categories.map((cat) => (
                                    <Option key={cat.id} value={cat.id}>
                                        {cat.category_name}
                                    </Option>
                                ))}
                            </Select>
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
                        <Form.Item
                            name="locale"
                            label="Language"
                            initialValue="en"
                        >
                            <Select>
                                {languages.map((lang) => (
                                    <Option
                                        key={lang.language_code}
                                        value={lang.language_code}
                                    >
                                        {lang.language_name}
                                    </Option>
                                ))}
                            </Select>
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
        <div className="space-y-4">
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
                    <Select
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
                    </Select>
                </Form.Item>

                <Form.Item name="office" label="Office Phone">
                    {countries.length > 0 ? (
                        <PhoneInput
                            placeholder="Enter office phone number"
                            countries={countries}
                            fieldName="office"
                        />
                    ) : (
                        <Input placeholder="Enter office phone number" />
                    )}
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
    ];

    return (
        <Drawer
            title={
                <div>
                    <Title level={4} className="mb-0">
                        Convert Lead to Client
                    </Title>
                    <span className="text-gray-500 text-sm">
                        Converting: {lead?.client_name}
                    </span>
                </div>
            }
            open={open}
            onClose={handleCancel}
            width={800}
            footer={
                <div className="flex justify-end space-x-2">
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Button
                        type="primary"
                        onClick={() => form.submit()}
                        loading={loading}
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
