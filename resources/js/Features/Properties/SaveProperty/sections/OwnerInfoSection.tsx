import React from "react";
import { Form, Input, Row, Col, Switch, Typography, Divider } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";

const { Text } = Typography;

interface OwnerInfoSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    /** Whether the current user is a sales manager (controls publishing visibility) */
    isSalesManager?: boolean;
}

const OwnerInfoSection: React.FC<OwnerInfoSectionProps> = ({
    form,
    primaryCategory,
    isSalesManager = false,
}) => {
    return (
        <div>
            {/* ─── Owner Contact Details ─── */}
            <Row gutter={[16, 0]}>
                {/* Owner Name */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["owner_info", "name"]}
                        label="Full Name of the Owner"
                    >
                        <Input placeholder="Full name" />
                    </Form.Item>
                </Col>

                {/* Phone */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["owner_info", "phone"]}
                        label="Telephone Number"
                    >
                        <Input placeholder="+90 533 XXX XXXX" />
                    </Form.Item>
                </Col>

                {/* Email */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["owner_info", "email"]}
                        label="E-mail Address"
                        rules={[
                            {
                                type: "email",
                                message: "Please enter a valid email",
                            },
                        ]}
                    >
                        <Input placeholder="owner@example.com" />
                    </Form.Item>
                </Col>
            </Row>

            {/* ─── Key Holder ─── */}
            <Divider className="!my-3" />
            <Text strong className="text-sm block mb-3">
                Key Holder
            </Text>
            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["owner_info", "key_holder_name"]}
                        label="Key Holder Name"
                    >
                        <Input placeholder="Name of the key holder" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["owner_info", "key_holder_phone"]}
                        label="Key Holder Telephone"
                    >
                        <Input placeholder="+90 533 XXX XXXX" />
                    </Form.Item>
                </Col>
            </Row>

            {/* ─── Publishing Permissions (Sales Manager only) ─── */}
            {isSalesManager && (
                <>
                    <Divider className="!my-3" />
                    <Text strong className="text-sm block mb-3">
                        Publishing Permissions
                    </Text>
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["owner_info", "allow_101evler_publish"]}
                                label="Permission for 101evler"
                                valuePropName="checked"
                            >
                                <Switch
                                    checkedChildren="Yes"
                                    unCheckedChildren="No"
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["owner_info", "allow_hangiev_publish"]}
                                label="Permission for Hangiev"
                                valuePropName="checked"
                            >
                                <Switch
                                    checkedChildren="Yes"
                                    unCheckedChildren="No"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </>
            )}
        </div>
    );
};

export default OwnerInfoSection;
