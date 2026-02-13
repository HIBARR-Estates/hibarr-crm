import React, { useState } from "react";
import { Form, Input, Switch, Row, Col, Select, Typography } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import CurrencyInput from "@/Components/CurrencyInput";

const { TextArea } = Input;
const { Text } = Typography;

const CURRENCY_OPTIONS = [
    { value: "GBP", label: "£ GBP" },
    { value: "TRY", label: "₺ TRY" },
    { value: "USD", label: "$ USD" },
    { value: "EUR", label: "€ EUR" },
];

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
 *
 * Land: single currency picker controlling all CurrencyInputs (defaults GBP)
 */
const InternalInfoSection: React.FC<InternalInfoSectionProps> = ({
    form,
    primaryCategory,
}) => {
    const isLand = primaryCategory === "land";
    const [landCurrency, setLandCurrency] = useState("GBP");

    // ─── Land layout: single currency selector for all prices ───
    if (isLand) {
        return (
            <div>
                {/* Currency selector */}
                <Row gutter={[16, 0]}>
                    <Col xs={24} md={8}>
                        <Text type="secondary" className="text-xs block mb-1">
                            Currency for all prices
                        </Text>
                        <Select
                            value={landCurrency}
                            onChange={setLandCurrency}
                            options={CURRENCY_OPTIONS}
                            style={{ width: "100%", marginBottom: 16 }}
                        />
                    </Col>
                </Row>

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
                                defaultCurrency={landCurrency}
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
                                defaultCurrency={landCurrency}
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
                                defaultCurrency={landCurrency}
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
                            <Switch
                                checkedChildren="Yes"
                                unCheckedChildren="No"
                            />
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
    }

    // ─── Non-land layout (unchanged) ───
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
