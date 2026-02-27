import React from "react";
import { Form, Input, Switch, Row, Col, Typography } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import CurrencyInput from "@/Components/CurrencyInput";

const { TextArea } = Input;
const { Text } = Typography;

interface InternalInfoSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    selectedCurrency?: string;
}

/**
 * Internal information not shown publicly:
 * - Price to owner / HIBARR price
 * - Commission agreement
 * - General notes
 * - Dues
 *
 * Currency controlled by the selectedCurrency prop from the parent form.
 */
const InternalInfoSection: React.FC<InternalInfoSectionProps> = ({
    form,
    primaryCategory,
    selectedCurrency,
}) => {
    return (
        <div>
            <Row gutter={[16, 0]}>
                {/* Price to Owner */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name="price_to_owner"
                        label="Price to Owner"
                        tooltip="The price agreed with the property owner"
                    >
                        <CurrencyInput
                            noFormItem
                            defaultCurrency={selectedCurrency}
                            placeholder="Owner's asking price"
                        />
                    </Form.Item>
                </Col>

                {/* HIBARR Price */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name="hibarr_price"
                        label="HIBARR Price"
                        tooltip="HIBARR's listed price"
                    >
                        <CurrencyInput
                            noFormItem
                            defaultCurrency={selectedCurrency}
                            placeholder="Listed price"
                        />
                    </Form.Item>
                </Col>

                {/* Dues */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name="dues"
                        label="Monthly Dues / Aidât"
                        tooltip="Monthly maintenance or site fees"
                    >
                        <CurrencyInput
                            noFormItem
                            defaultCurrency={selectedCurrency}
                            placeholder="Monthly dues"
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 0]}>
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
            </Row>

            {/* General Notes */}
            <Row gutter={[16, 0]}>
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
        </div>
    );
};

export default InternalInfoSection;
