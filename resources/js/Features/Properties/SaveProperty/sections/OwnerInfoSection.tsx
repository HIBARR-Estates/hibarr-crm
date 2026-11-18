import React from "react";
import { Form, Input, Row, Col, Switch, Typography, Divider } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
    return (
        <div>
            {/* ─── Owner Contact Details ─── */}
            <Row gutter={[16, 0]}>
                {/* Owner Name */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["owner_info", "name"]}
                        label={td("Full Name of the Owner", { source: "en" })}
                    >
                        <Input placeholder={td("Full name", { source: "en" })} />
                    </Form.Item>
                </Col>

                {/* Phone */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["owner_info", "phone"]}
                        label={td("Telephone Number", { source: "en" })}
                    >
                        <Input placeholder={td("+90 533 XXX XXXX", { source: "en" })} />
                    </Form.Item>
                </Col>

                {/* Email */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["owner_info", "email"]}
                        label={td("E-mail Address", { source: "en" })}
                        rules={[
                            {
                                type: "email",
                                message: "Please enter a valid email",
                            },
                        ]}
                    >
                        <Input placeholder={td("owner@example.com", { source: "en" })} />
                    </Form.Item>
                </Col>
            </Row>

            {/* ─── Key Holder ─── */}
            <Divider className="!my-3" />
            <Text strong className="text-sm block mb-3">
                {td("Key Holder", { source: "en" })}
            </Text>
            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["owner_info", "key_holder_name"]}
                        label={td("Key Holder Name", { source: "en" })}
                    >
                        <Input placeholder={td("Name of the key holder", { source: "en" })} />
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["owner_info", "key_holder_phone"]}
                        label={td("Key Holder Telephone", { source: "en" })}
                    >
                        <Input placeholder={td("+90 533 XXX XXXX", { source: "en" })} />
                    </Form.Item>
                </Col>
            </Row>

            {/* ─── Publishing Permissions (Sales Manager only) ─── */}
            {isSalesManager && (
                <>
                    <Divider className="!my-3" />
                    <Text strong className="text-sm block mb-3">
                        {td("Publishing Permissions", { source: "en" })}
                    </Text>
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["owner_info", "allow_101evler_publish"]}
                                label={td("Permission for 101evler", { source: "en" })}
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
                                label={td("Permission for Hangiev", { source: "en" })}
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
