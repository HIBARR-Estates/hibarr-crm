import React, { useState, useEffect } from "react";
import { Row, Col, Input, Upload, Typography, Form, Select } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { Lead, Country } from "@/Types";
import PhoneInput from "antd-phone-input";
import { useCountries } from "@/Hooks/useFormData";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Title } = Typography;
const { TextArea } = Input;

interface Props {
    form: any;
    lead?: Lead;
    employees: any[];
    permissions: {
        add_clients: string;
        manage_client_category: string;
        manage_client_subcategory: string;
        add_client_note: string;
    };
}

const CompanyDetailsTab: React.FC<Props> = ({
    form,
    lead,
    employees,
    permissions,
}) => {
    const { td } = useTd();
    const { countries } = useCountries();

    const [selectedCountry, setSelectedCountry] = useState<Country | null>(
        null
    );

    // Find country by name if lead has country
    useEffect(() => {
        if (lead?.country && countries) {
            const country = countries.find((c) => c.nicename === lead.country);
            if (country) {
                setSelectedCountry(country);
            }
        }
    }, [lead, countries]);

    return (
        <div>
            <Title level={4} className="mb-6">
                {td("Company Details", { source: "en" })}
            </Title>

            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Form.Item name="company_name" label={td("Company Name", { source: "en" })}>
                        <Input placeholder={td("Enter company name", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="website" label={td("Website", { source: "en" })}>
                        <Input placeholder={td("Enter website URL", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="tax_name" label={td("Tax Name", { source: "en" })}>
                        <Input placeholder={td("Enter tax name (GST/VAT)", { source: "en" })} />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Form.Item name="gst_number" label={td("GST Number", { source: "en" })}>
                        <Input placeholder={td("Enter GST number", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col span={12}>
                    <Form.Item name="office" label={td("Office Phone Number", { source: "en" })}>
                        <PhoneInput 
                            enableSearch 
                            placeholder={td("Enter office phone number", { source: "en" })}
                            country=""
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="city" label={td("City", { source: "en" })}>
                        <Input placeholder={td("Enter city", { source: "en" })} />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Form.Item name="state" label={td("State", { source: "en" })}>
                        <Input placeholder={td("Enter state", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="postal_code" label={td("Postal Code", { source: "en" })}>
                        <Input placeholder={td("Enter postal code", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="country_company" label={td("Country", { source: "en" })}>
                        <Select
                            placeholder={td("Select country", { source: "en" })}
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? "")
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                            options={countries.map((country) => ({
                                value: country.id,
                                label: country.nicename,
                            }))}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={12}>
                    <Form.Item name="address" label={td("Company Address", { source: "en" })}>
                        <TextArea
                            rows={4}
                            placeholder={td("Enter company address", { source: "en" })}
                        />
                    </Form.Item>
                </Col>

                <Col span={12}>
                    <Form.Item name="shipping_address" label={td("Shipping Address", { source: "en" })}>
                        <TextArea
                            rows={4}
                            placeholder={td("Enter shipping address", { source: "en" })}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row>
                <Col span={24}>
                    <Form.Item name="company_logo" label={td("Company Logo", { source: "en" })}>
                        <Upload
                            listType="picture-card"
                            maxCount={1}
                            accept=".png,.jpg,.jpeg,.svg,.bmp"
                            beforeUpload={() => false} // Prevent auto upload
                        >
                            <div>
                                <PlusOutlined />
                                <div className="mt-2">{td("Upload Logo", { source: "en" })}</div>
                            </div>
                        </Upload>
                    </Form.Item>
                </Col>
            </Row>
        </div>
    );
};

export default CompanyDetailsTab;
