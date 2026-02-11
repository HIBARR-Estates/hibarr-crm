import React from "react";
import { Form, Input, Switch, Row, Col } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import CurrencyInput from "@/Components/CurrencyInput";

const { TextArea } = Input;

interface InternalInfoSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
}

/**
 * Internal information not shown publicly:
 * - Price to owner / HIBARR price
 * - Commission agreement
 * - General notes
 * - Dues
 */
const InternalInfoSection: React.FC<InternalInfoSectionProps> = ({
    form,
    primaryCategory,
}) => {
    return (
        <Row gutter={[16, 0]}>
            {/* Price to Owner */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="price_to_owner"
                    label="Price to Owner"
                    tooltip="The price agreed with the property owner"
                >
                    <CurrencyInput
                        noFormItem
                        placeholder="Owner's asking price"
                    />
                </Form.Item>
            </Col>

            {/* HIBARR Price */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="hibarr_price"
                    label="HIBARR Price"
                    tooltip="HIBARR's listed price"
                >
                    <CurrencyInput noFormItem placeholder="Listed price" />
                </Form.Item>
            </Col>

            {/* Dues */}
            <Col xs={24} md={8}>
                <Form.Item
                    name="dues"
                    label="Monthly Dues / Aidât"
                    tooltip="Monthly maintenance or site fees"
                >
                    <CurrencyInput noFormItem placeholder="Monthly dues" />
                </Form.Item>
            </Col>

            {/* Commission Agreement */}
            <Col xs={24} md={8}>
                <Form.Item
                    name="commission_agreement_signed"
                    label="Commission Agreement Signed"
                    valuePropName="checked"
                >
                    <Switch checkedChildren="Yes" unCheckedChildren="No" />
                </Form.Item>
            </Col>

            {/* General Notes */}
            <Col span={24}>
                <Form.Item
                    name="general_notes"
                    label="General Notes"
                    tooltip="Internal notes visible only to staff"
                >
                    <TextArea
                        rows={3}
                        placeholder="Any additional internal notes about this property..."
                    />
                </Form.Item>
            </Col>
        </Row>
    );
};

export default InternalInfoSection;
