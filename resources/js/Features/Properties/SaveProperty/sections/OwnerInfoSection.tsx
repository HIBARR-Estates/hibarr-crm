import React, { useEffect } from "react";
import { Form, Input, Row, Col, Switch, Typography } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import { usePage } from "@inertiajs/react";

const { TextArea } = Input;
const { Text } = Typography;

interface OwnerInfoSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    /** Whether the current user is a sales manager (controls agent & publishing visibility) */
    isSalesManager?: boolean;
}

const OwnerInfoSection: React.FC<OwnerInfoSectionProps> = ({
    form,
    primaryCategory,
    isSalesManager = false,
}) => {
    const isLand = primaryCategory === "land";
    const { props } = usePage<any>();

    // Auto-assign agent_responsible from logged-in user for land
    useEffect(() => {
        if (isLand && props?.user?.name) {
            const current = form.getFieldValue([
                "owner_info",
                "agent_responsible",
            ]);
            if (!current) {
                form.setFieldValue(
                    ["owner_info", "agent_responsible"],
                    props.user.name,
                );
            }
        }
    }, [isLand, props?.user?.name, form]);

    // ─── Land layout ───
    if (isLand) {
        return (
            <div>
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

                {isSalesManager && (
                    <>
                        {/* Agent Responsible — read-only, auto-populated */}
                        <Row gutter={[16, 0]}>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    name={["owner_info", "agent_responsible"]}
                                    label="Agent Responsible"
                                    tooltip="Automatically assigned to the agent who creates this listing"
                                >
                                    <Input disabled />
                                </Form.Item>
                            </Col>
                        </Row>

                        {/* Publishing Permissions */}
                        <Text
                            type="secondary"
                            className="text-xs block mb-2 mt-1"
                        >
                            Publishing Permissions
                        </Text>
                        <Row gutter={[16, 0]}>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    name={[
                                        "owner_info",
                                        "allow_101evler_publish",
                                    ]}
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
                                    name={[
                                        "owner_info",
                                        "allow_hangiev_publish",
                                    ]}
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
    }

    // ─── Non-land layout (unchanged) ───
    return (
        <Row gutter={[16, 0]}>
            {/* Owner Name */}
            <Col xs={24} md={8}>
                <Form.Item name={["owner_info", "name"]} label="Owner Name">
                    <Input placeholder="Full name" />
                </Form.Item>
            </Col>

            {/* Phone */}
            <Col xs={24} md={8}>
                <Form.Item name={["owner_info", "phone"]} label="Phone Number">
                    <Input placeholder="+90 533 XXX XXXX" />
                </Form.Item>
            </Col>

            {/* Email */}
            <Col xs={24} md={8}>
                <Form.Item
                    name={["owner_info", "email"]}
                    label="Email"
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

            {/* Preferred Contact */}
            <Col xs={24} md={8}>
                <Form.Item
                    name={["owner_info", "preferred_contact"]}
                    label="Preferred Contact"
                >
                    <Input placeholder="e.g. WhatsApp, Phone call" />
                </Form.Item>
            </Col>

            {/* Nationality */}
            <Col xs={24} md={8}>
                <Form.Item
                    name={["owner_info", "nationality"]}
                    label="Nationality"
                >
                    <Input placeholder="e.g. Turkish, British" />
                </Form.Item>
            </Col>

            {/* ID / Tax Number */}
            <Col xs={24} md={8}>
                <Form.Item
                    name={["owner_info", "id_number"]}
                    label="ID / Tax Number"
                >
                    <Input placeholder="National ID or Tax No" />
                </Form.Item>
            </Col>

            {/* Owner Address */}
            <Col span={24}>
                <Form.Item
                    name={["owner_info", "address"]}
                    label="Owner Address"
                >
                    <TextArea rows={2} placeholder="Owner's home address" />
                </Form.Item>
            </Col>

            {/* Bank Details */}
            <Col span={24}>
                <Form.Item
                    name={["owner_info", "bank_details"]}
                    label="Bank Details"
                >
                    <TextArea
                        rows={2}
                        placeholder="IBAN, bank name, account holder..."
                    />
                </Form.Item>
            </Col>

            {/* Notes */}
            <Col span={24}>
                <Form.Item
                    name={["owner_info", "notes"]}
                    label="Internal Notes"
                >
                    <TextArea
                        rows={3}
                        placeholder="Private notes about the owner..."
                    />
                </Form.Item>
            </Col>
        </Row>
    );
};

export default OwnerInfoSection;
