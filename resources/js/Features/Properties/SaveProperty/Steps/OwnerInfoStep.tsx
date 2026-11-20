import React from "react";
import { Form, Input, Row, Col, Card, Typography, Divider, Alert } from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues } from "@/Types";
import {
    UserOutlined,
    PhoneOutlined,
    MailOutlined,
    LockOutlined,
    FileTextOutlined,
} from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Text } = Typography;
const { TextArea } = Input;

interface OwnerInfoStepProps {
    form: FormInstance;
    enumValues?: PropertyEnumValues;
    data?: Partial<Property>;
}

export default function OwnerInfoStep({
    form,
    enumValues,
    data,
}: OwnerInfoStepProps) {
    const { td } = useTd();
    return (
        <Card size="small" className="border-0 shadow-none">
            <Alert
                message={td("Confidential Information", { source: "en" })}
                description={td("Owner contact details are only visible to the property creator, responsible agent, and administrators. Other agents can request access.", { source: "en" })}
                type="info"
                icon={<LockOutlined />}
                showIcon
                className="mb-4"
            />

            <Text type="secondary" className="block mb-4">
                <UserOutlined className="mr-2" />
                {td("Enter the property owner's contact information for internal reference.", { source: "en" })}
            </Text>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "name"]}
                        label={
                            <span>
                                <UserOutlined className="mr-2" />
                                {td("Owner Name", { source: "en" })}
                            </span>
                        }
                    >
                        <Input placeholder={td("Full name of the property owner", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "phone"]}
                        label={
                            <span>
                                <PhoneOutlined className="mr-2" />
                                {td("Phone Number", { source: "en" })}
                            </span>
                        }
                    >
                        <Input placeholder="+90 555 123 4567" />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "email"]}
                        label={
                            <span>
                                <MailOutlined className="mr-2" />
                                {td("Email Address", { source: "en" })}
                            </span>
                        }
                        rules={[
                            {
                                type: "email",
                                message: "Please enter a valid email address",
                            },
                        ]}
                    >
                        <Input placeholder={td("owner@example.com", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "preferred_contact"]}
                        label={td("Preferred Contact Method", { source: "en" })}
                    >
                        <Input placeholder={td("e.g., WhatsApp, Phone, Email", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Divider className="my-2" />
                </Col>

                <Col span={24}>
                    <Form.Item
                        name={["owner_info", "address"]}
                        label={td("Owner Address", { source: "en" })}
                    >
                        <TextArea
                            rows={2}
                            placeholder={td("Property owner's address (optional)", { source: "en" })}
                        />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item
                        name={["owner_info", "notes"]}
                        label={
                            <span>
                                <FileTextOutlined className="mr-2" />
                                {td("Internal Notes", { source: "en" })}
                            </span>
                        }
                    >
                        <TextArea
                            rows={3}
                            placeholder={td("Any notes about the owner, communication preferences, availability, etc.", { source: "en" })}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Divider className="my-4">{td("Additional Owner Details", { source: "en" })}</Divider>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "nationality"]}
                        label={td("Nationality", { source: "en" })}
                    >
                        <Input placeholder={td("e.g., Turkish, British", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "id_number"]}
                        label={td("ID / Tax Number", { source: "en" })}
                        tooltip={td("For internal records only", { source: "en" })}
                    >
                        <Input placeholder={td("ID or Tax number", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item
                        name={["owner_info", "bank_details"]}
                        label={td("Bank Details", { source: "en" })}
                        tooltip={td("For payment processing", { source: "en" })}
                    >
                        <TextArea
                            rows={2}
                            placeholder={td("Bank name, IBAN, account holder name...", { source: "en" })}
                        />
                    </Form.Item>
                </Col>
            </Row>
        </Card>
    );
}
