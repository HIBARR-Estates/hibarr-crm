import React from "react";
import { Form, Input, Select, Row, Col } from "antd";
import { CreateLeadFormData } from "@/Types/api/leads";
import { usePage } from "@inertiajs/react";
import PhoneInput from "antd-phone-input";

interface ContactDetailsTabProps {
    data: CreateLeadFormData;
    setData: (key: keyof CreateLeadFormData, value: any) => void;
    errors: Record<string, string>;
}

const ContactDetailsTab: React.FC<ContactDetailsTabProps> = ({
    data,
    setData,
    errors,
}) => {
    const { props } = usePage<any>();
    const { countries } = props;
    return (
        <div className="space-y-6">
            <Row gutter={[24, 16]}>
                <Col span={12}>
                    <Form.Item
                        label="Company Name"
                        validateStatus={errors.company_name ? "error" : ""}
                        help={errors.company_name}
                    >
                        <Input
                            placeholder="Enter company name"
                            value={data.company_name}
                            onChange={(e) =>
                                setData("company_name", e.target.value)
                            }
                        />
                    </Form.Item>
                </Col>

                <Col span={12}>
                    <Form.Item
                        label="Website"
                        validateStatus={errors.website ? "error" : ""}
                        help={errors.website}
                    >
                        <Input
                            placeholder="Enter website URL"
                            value={data.website}
                            onChange={(e) => setData("website", e.target.value)}
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label="Cell Phone"
                        validateStatus={errors.cell ? "error" : ""}
                        help={errors.cell}
                    >
                        <PhoneInput
                            enableSearch
                            placeholder="Enter cell phone number"
                            value={data.cell}
                            onChange={(val) => setData("cell", val)}
                            country=""
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label="Office Phone"
                        validateStatus={errors.office ? "error" : ""}
                        help={errors.office}
                    >
                        <PhoneInput
                            enableSearch
                            placeholder="Enter office phone number"
                            value={data.office}
                            onChange={(val) => setData("office", val)}
                            country=""
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label="Country"
                        validateStatus={errors.country ? "error" : ""}
                        help={errors.country}
                    >
                        <Select
                            placeholder="Select country"
                            value={data.country}
                            onChange={(value) => setData("country", value)}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        >
                            {countries.map(
                                (country: {
                                    iso: string;
                                    nicename: string;
                                }) => (
                                    <Select.Option
                                        key={country.iso}
                                        value={country.nicename}
                                    >
                                        <span
                                            className={`flag-icon flag-icon-${country.iso.toLowerCase()} mr-2`}
                                        />
                                        {country.nicename}
                                    </Select.Option>
                                )
                            )}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label="State/Province"
                        validateStatus={errors.state ? "error" : ""}
                        help={errors.state}
                    >
                        <Input
                            placeholder="Enter state or province"
                            value={data.state}
                            onChange={(e) => setData("state", e.target.value)}
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label="City"
                        validateStatus={errors.city ? "error" : ""}
                        help={errors.city}
                    >
                        <Input
                            placeholder="Enter city"
                            value={data.city}
                            onChange={(e) => setData("city", e.target.value)}
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label="Postal Code"
                        validateStatus={errors.postal_code ? "error" : ""}
                        help={errors.postal_code}
                    >
                        <Input
                            placeholder="Enter postal code"
                            value={data.postal_code}
                            onChange={(e) =>
                                setData("postal_code", e.target.value)
                            }
                        />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item
                        label="Address"
                        validateStatus={errors.address ? "error" : ""}
                        help={errors.address}
                    >
                        <Input.TextArea
                            placeholder="Enter full address"
                            value={data.address}
                            onChange={(e) => setData("address", e.target.value)}
                            rows={3}
                        />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    );
};

export default ContactDetailsTab;
