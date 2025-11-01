import React, { useState, useEffect } from "react";
import {
    Row,
    Col,
    Input,
    Select,
    Radio,
    Button,
    Upload,
    Typography,
    Space,
    Form,
} from "antd";
import {
    EyeOutlined,
    EyeInvisibleOutlined,
    ReadOutlined as RandomOutlined,
    PlusOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import { Lead, Country, ClientCategory, Salutation, Language } from "@/Types";
import PhoneInput from "@/Components/PhoneInput";

const { Title } = Typography;
const { TextArea } = Input;

interface Props {
    form: any;
    lead?: Lead;
    employees: any[];
    countries: Country[];
    categories: ClientCategory[];
    salutations: { value: string; label: string }[];
    languages: Language[];
    permissions: {
        add_clients: string;
        manage_client_category: string;
        manage_client_subcategory: string;
        add_client_note: string;
    };
}

const AccountDetailsTab: React.FC<Props> = ({
    form,
    lead,
    employees,
    countries,
    categories,
    salutations,
    languages,
    permissions,
}) => {
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<Country | null>(
        null
    );
    const [subCategories, setSubCategories] = useState<any[]>([]);

    // Find country by name if lead has country
    useEffect(() => {
        if (lead?.country && countries) {
            const country = countries.find((c) => c.nicename === lead.country);
            if (country) {
                setSelectedCountry(country);
            }
        }
    }, [lead, countries]);

    const generateRandomPassword = () => {
        const password = Math.random().toString(36).substr(2, 8);
        form.setFieldValue("password", password);
    };

    const handleCategoryChange = async (categoryId: string) => {
        if (!categoryId) {
            setSubCategories([]);
            form.setFieldValue("sub_category_id", undefined);
            return;
        }

        try {
            const response = await fetch(
                route("get_client_sub_categories", categoryId)
            );
            const data = await response.json();
            if (data.status === "success") {
                setSubCategories(data.data || []);
            }
        } catch (error) {
            console.error("Error fetching subcategories:", error);
            setSubCategories([]);
        }
    };

    return (
        <div>
            <Title level={4} className="mb-6">
                Account Details
            </Title>

            <Row gutter={[24, 16]}>
                <Col span={18}>
                    <Row gutter={[16, 16]}>
                        <Col span={8}>
                            <Form.Item name="salutation" label="Salutation">
                                <Select
                                    placeholder="Select salutation"
                                    allowClear
                                    options={salutations}
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                name="name"
                                label="Client Name"
                                rules={[
                                    {
                                        required: true,
                                        message: "Client name is required",
                                    },
                                ]}
                            >
                                <Input placeholder="Enter client name" />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                name="email"
                                label="Email"
                                rules={[
                                    {
                                        type: "email",
                                        message: "Please enter a valid email",
                                    },
                                ]}
                            >
                                <Input placeholder="Enter email address" />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                name="password"
                                label="Password"
                                extra="Required for login"
                            >
                                <Input.Group compact>
                                    <Input.Password
                                        placeholder="Enter password"
                                        visibilityToggle={{
                                            visible: passwordVisible,
                                            onVisibleChange: setPasswordVisible,
                                        }}
                                        style={{ width: "calc(100% - 32px)" }}
                                    />
                                    <Button
                                        icon={<RandomOutlined />}
                                        onClick={generateRandomPassword}
                                        title="Generate random password"
                                    />
                                </Input.Group>
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item name="country" label="Country">
                                <Select
                                    placeholder="Select country"
                                    showSearch
                                    filterOption={(input, option) =>
                                        (option?.label ?? "")
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    onChange={(countryId) => {
                                        const country = countries.find(
                                            (c) => c.id === countryId
                                        );
                                        setSelectedCountry(country || null);
                                    }}
                                    options={countries.map((country) => ({
                                        value: country.id,
                                        label: country.nicename,
                                    }))}
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item name="mobile" label="Mobile">
                                <PhoneInput
                                    countries={countries}
                                    defaultCountry={selectedCountry}
                                    fieldName="mobile"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Col>

                <Col span={6}>
                    <Form.Item name="image" label="Profile Picture">
                        <Upload
                            listType="picture-card"
                            maxCount={1}
                            accept=".png,.jpg,.jpeg,.svg,.bmp"
                            beforeUpload={() => false} // Prevent auto upload
                        >
                            <div>
                                <PlusOutlined />
                                <div className="mt-2">Upload</div>
                            </div>
                        </Upload>
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Form.Item name="gender" label="Gender">
                        <Select
                            options={[
                                { value: "male", label: "Male" },
                                { value: "female", label: "Female" },
                                { value: "others", label: "Others" },
                            ]}
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="locale" label="Language">
                        <Select
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? "")
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                            options={languages.map((lang) => ({
                                value: lang.language_code,
                                label: lang.language_name,
                            }))}
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="category_id" label="Client Category">
                        <Input.Group compact>
                            <Select
                                placeholder="Select category"
                                style={{
                                    width:
                                        permissions.manage_client_category ===
                                        "all"
                                            ? "calc(100% - 60px)"
                                            : "100%",
                                }}
                                allowClear
                                onChange={handleCategoryChange}
                                options={categories.map((cat) => ({
                                    value: cat.id,
                                    label: cat.category_name,
                                }))}
                            />
                            {permissions.manage_client_category === "all" && (
                                <Button
                                    icon={<PlusOutlined />}
                                    title="Add Category"
                                />
                            )}
                        </Input.Group>
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Form.Item
                        name="sub_category_id"
                        label="Client Sub Category"
                    >
                        <Input.Group compact>
                            <Select
                                placeholder="Select sub category"
                                style={{
                                    width:
                                        permissions.manage_client_subcategory ===
                                        "all"
                                            ? "calc(100% - 60px)"
                                            : "100%",
                                }}
                                allowClear
                                options={subCategories.map((subCat) => ({
                                    value: subCat.id,
                                    label: subCat.category_name,
                                }))}
                            />
                            {permissions.manage_client_subcategory ===
                                "all" && (
                                <Button
                                    icon={<PlusOutlined />}
                                    title="Add Sub Category"
                                />
                            )}
                        </Input.Group>
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="login" label="Client Can Login">
                        <Radio.Group>
                            <Radio value="enable">Yes</Radio>
                            <Radio value="disable">No</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="sendMail" label="Email Notifications">
                        <Radio.Group>
                            <Radio value="yes">Yes</Radio>
                            <Radio value="no">No</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>
            </Row>

            {permissions.add_clients === "all" && (
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <Form.Item name="added_by" label="Added By">
                            <Select
                                placeholder="Select employee"
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.label ?? "")
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                                options={employees.map((emp) => ({
                                    value: emp.id,
                                    label: emp.name,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                </Row>
            )}

            {(permissions.add_client_note === "all" ||
                permissions.add_client_note === "added" ||
                permissions.add_client_note === "both") && (
                <Row>
                    <Col span={24}>
                        <Form.Item name="note" label="Note">
                            <TextArea
                                rows={4}
                                placeholder="Enter note about the client"
                            />
                        </Form.Item>
                    </Col>
                </Row>
            )}
        </div>
    );
};

export default AccountDetailsTab;
