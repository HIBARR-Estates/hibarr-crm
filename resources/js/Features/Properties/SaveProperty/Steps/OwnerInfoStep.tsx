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
    return (
        <Card size="small" className="border-0 shadow-none">
            <Alert
                message="Confidential Information"
                description="Owner contact details are only visible to the property creator, responsible agent, and administrators. Other agents can request access."
                type="info"
                icon={<LockOutlined />}
                showIcon
                className="mb-4"
            />

            <Text type="secondary" className="block mb-4">
                <UserOutlined className="mr-2" />
                Enter the property owner's contact information for internal
                reference.
            </Text>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "name"]}
                        label={
                            <span>
                                <UserOutlined className="mr-2" />
                                Owner Name
                            </span>
                        }
                    >
                        <Input placeholder="Full name of the property owner" />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "phone"]}
                        label={
                            <span>
                                <PhoneOutlined className="mr-2" />
                                Phone Number
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
                                Email Address
                            </span>
                        }
                        rules={[
                            {
                                type: "email",
                                message: "Please enter a valid email address",
                            },
                        ]}
                    >
                        <Input placeholder="owner@example.com" />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "preferred_contact"]}
                        label="Preferred Contact Method"
                    >
                        <Input placeholder="e.g., WhatsApp, Phone, Email" />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Divider className="my-2" />
                </Col>

                <Col span={24}>
                    <Form.Item
                        name={["owner_info", "address"]}
                        label="Owner Address"
                    >
                        <TextArea
                            rows={2}
                            placeholder="Property owner's address (optional)"
                        />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item
                        name={["owner_info", "notes"]}
                        label={
                            <span>
                                <FileTextOutlined className="mr-2" />
                                Internal Notes
                            </span>
                        }
                    >
                        <TextArea
                            rows={3}
                            placeholder="Any notes about the owner, communication preferences, availability, etc."
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Divider className="my-4">Additional Owner Details</Divider>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "nationality"]}
                        label="Nationality"
                    >
                        <Input placeholder="e.g., Turkish, British" />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["owner_info", "id_number"]}
                        label="ID / Tax Number"
                        tooltip="For internal records only"
                    >
                        <Input placeholder="ID or Tax number" />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item
                        name={["owner_info", "bank_details"]}
                        label="Bank Details"
                        tooltip="For payment processing"
                    >
                        <TextArea
                            rows={2}
                            placeholder="Bank name, IBAN, account holder name..."
                        />
                    </Form.Item>
                </Col>
            </Row>
        </Card>
    );
}
