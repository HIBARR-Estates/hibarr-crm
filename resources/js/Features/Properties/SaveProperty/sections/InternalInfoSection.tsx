import React from "react";
import { Form, Input, Switch, Row, Col, Typography } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import CurrencyInput from "@/Components/CurrencyInput";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
    return (
        <div>
            <Row gutter={[16, 0]}>
                {/* Price to Owner */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name="price_to_owner"
                        label={td("Price to Owner", { source: "en" })}
                        tooltip={td("The price agreed with the property owner", { source: "en" })}
                    >
                        <CurrencyInput
                            noFormItem
                            defaultCurrency={selectedCurrency}
                            placeholder={td("Owner's asking price", { source: "en" })}
                        />
                    </Form.Item>
                </Col>

                {/* HIBARR Price */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name="hibarr_price"
                        label={td("HIBARR Price", { source: "en" })}
                        tooltip={td("HIBARR's listed price", { source: "en" })}
                    >
                        <CurrencyInput
                            noFormItem
                            defaultCurrency={selectedCurrency}
                            placeholder={td("Listed price", { source: "en" })}
                        />
                    </Form.Item>
                </Col>

                {/* Dues */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name="dues"
                        label={td("Monthly Dues / Aidât", { source: "en" })}
                        tooltip={td("Monthly maintenance or site fees", { source: "en" })}
                    >
                        <CurrencyInput
                            noFormItem
                            defaultCurrency={selectedCurrency}
                            placeholder={td("Monthly dues", { source: "en" })}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 0]}>
                {/* Commission Agreement */}
                <Col xs={24} md={8}>
                    <Form.Item
                        name="commission_agreement_signed"
                        label={td("Commission Agreement Signed", { source: "en" })}
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
                        label={td("General Notes", { source: "en" })}
                        tooltip={td("Internal notes visible only to staff", { source: "en" })}
                    >
                        <TextArea
                            rows={3}
                            placeholder={td("Any additional internal notes about this property...", { source: "en" })}
                        />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    );
};

export default InternalInfoSection;
