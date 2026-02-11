import React from "react";
import { Form, Input, Row, Col } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";

const { TextArea } = Input;

interface OwnerInfoSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
}

const OwnerInfoSection: React.FC<OwnerInfoSectionProps> = ({
    form,
    primaryCategory,
}) => {
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
