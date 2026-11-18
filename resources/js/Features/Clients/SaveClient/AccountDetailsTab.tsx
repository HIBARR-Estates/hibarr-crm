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
import PhoneInput from "antd-phone-input";
import { useCountries } from "@/Hooks/useFormData";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Title } = Typography;
const { TextArea } = Input;

interface Props {
    form: any;
    lead?: Lead;
    employees: any[];
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
    categories,
    salutations,
    languages,
    permissions,
}) => {
    const { td } = useTd();
    const { countries } = useCountries();

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
                {td("Account Details", { source: "en" })}
            </Title>

            <Row gutter={[24, 16]}>
                <Col span={18}>
                    <Row gutter={[16, 16]}>
                        <Col span={8}>
                            <Form.Item name="salutation" label={td("Salutation", { source: "en" })}>
                                <Select
                                    placeholder={td("Select salutation", { source: "en" })}
                                    allowClear
                                    options={salutations}
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                name="name"
                                label={td("Client Name", { source: "en" })}
                                rules={[
                                    {
                                        required: true,
                                        message: "Client name is required",
                                    },
                                ]}
                            >
                                <Input placeholder={td("Enter client name", { source: "en" })} />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                name="email"
                                label={td("Email", { source: "en" })}
                                rules={[
                                    {
                                        type: "email",
                                        message: "Please enter a valid email",
                                    },
                                ]}
                            >
                                <Input placeholder={td("Enter email address", { source: "en" })} />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                name="password"
                                label={td("Password", { source: "en" })}
                                extra="Required for login"
                            >
                                <Input.Group compact>
                                    <Input.Password
                                        placeholder={td("Enter password", { source: "en" })}
                                        visibilityToggle={{
                                            visible: passwordVisible,
                                            onVisibleChange: setPasswordVisible,
                                        }}
                                        style={{ width: "calc(100% - 32px)" }}
                                    />
                                    <Button
                                        icon={<RandomOutlined />}
                                        onClick={generateRandomPassword}
                                        title={td("Generate random password", { source: "en" })}
                                    />
                                </Input.Group>
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item name="country" label={td("Country", { source: "en" })}>
                                <Select
                                    placeholder={td("Select country", { source: "en" })}
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
                            <Form.Item name="mobile" label={td("Mobile", { source: "en" })}>
                                <PhoneInput 
                                    enableSearch 
                                    placeholder={td("Enter mobile number", { source: "en" })}
                                    country=""
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Col>

                <Col span={6}>
                    <Form.Item name="image" label={td("Profile Picture", { source: "en" })}>
                        <Upload
                            listType="picture-card"
                            maxCount={1}
                            accept=".png,.jpg,.jpeg,.svg,.bmp"
                            beforeUpload={() => false} // Prevent auto upload
                        >
                            <div>
                                <PlusOutlined />
                                <div className="mt-2">{td("Upload", { source: "en" })}</div>
                            </div>
                        </Upload>
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Form.Item name="gender" label={td("Gender", { source: "en" })}>
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
                    <Form.Item name="locale" label={td("Language", { source: "en" })}>
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
                    <Form.Item name="category_id" label={td("Client Category", { source: "en" })}>
                        <Input.Group compact>
                            <Select
                                placeholder={td("Select category", { source: "en" })}
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
                                    title={td("Add Category", { source: "en" })}
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
                        label={td("Client Sub Category", { source: "en" })}
                    >
                        <Input.Group compact>
                            <Select
                                placeholder={td("Select sub category", { source: "en" })}
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
                                    title={td("Add Sub Category", { source: "en" })}
                                />
                            )}
                        </Input.Group>
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="login" label={td("Client Can Login", { source: "en" })}>
                        <Radio.Group>
                            <Radio value="enable">{td("Yes", { source: "en" })}</Radio>
                            <Radio value="disable">{td("No", { source: "en" })}</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="sendMail" label={td("Email Notifications", { source: "en" })}>
                        <Radio.Group>
                            <Radio value="yes">{td("Yes", { source: "en" })}</Radio>
                            <Radio value="no">{td("No", { source: "en" })}</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>
            </Row>

            {permissions.add_clients === "all" && (
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <Form.Item name="added_by" label={td("Added By", { source: "en" })}>
                            <Select
                                placeholder={td("Select employee", { source: "en" })}
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
                        <Form.Item name="note" label={td("Note", { source: "en" })}>
                            <TextArea
                                rows={4}
                                placeholder={td("Enter note about the client", { source: "en" })}
                            />
                        </Form.Item>
                    </Col>
                </Row>
            )}
        </div>
    );
};

export default AccountDetailsTab;
