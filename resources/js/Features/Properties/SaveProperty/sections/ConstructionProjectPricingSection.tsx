import React from "react";
import {
    Form,
    Input,
    InputNumber,
    Select,
    Switch,
    Row,
    Col,
    Button,
    Typography,
} from "antd";
import type { FormInstance } from "antd/lib/form";
import { LinkOutlined } from "@ant-design/icons";
import { DOWNPAYMENT_TYPE_OPTIONS } from "../constructionProjectConfig";

const { Text } = Typography;

interface ConstructionProjectPricingSectionProps {
    form: FormInstance;
}

/**
 * Construction project pricing:
 * - Starting price
 * - Payment plan (toggle) with sub-fields: downpayment type/value, period, interest
 * - Availability button (links to Google Drive sheet)
 */
const ConstructionProjectPricingSection: React.FC<
    ConstructionProjectPricingSectionProps
> = ({ form }) => {
    const paymentPlan = Form.useWatch("payment_plan", form);
    const paymentPlanEnabled = paymentPlan?.enabled ?? false;
    const availabilityLink = Form.useWatch("availability_link", form);

    const handlePaymentPlanToggle = (enabled: boolean) => {
        const current = form.getFieldValue("payment_plan") || {};
        form.setFieldValue("payment_plan", {
            ...current,
            enabled,
        });
    };

    const handlePaymentPlanField = (field: string, value: any) => {
        const current = form.getFieldValue("payment_plan") || {};
        form.setFieldValue("payment_plan", {
            ...current,
            [field]: value,
        });
    };

    return (
        <Row gutter={[16, 0]}>
            {/* Starting Price */}
            <Col xs={24} md={8}>
                <Form.Item name="starting_price" label="Starting Price">
                    <InputNumber<number>
                        min={0}
                        placeholder="e.g. 85000"
                        style={{ width: "100%" }}
                        formatter={(value) =>
                            value
                                ? `£ ${value}`.replace(
                                      /\B(?=(\d{3})+(?!\d))/g,
                                      ",",
                                  )
                                : ""
                        }
                        parser={(value) =>
                            value ? Number(value.replace(/[£,\s]/g, "")) : 0
                        }
                    />
                </Form.Item>
            </Col>

            {/* Availability Link */}
            <Col xs={24} md={8}>
                <Form.Item
                    name="availability_link"
                    label="Availability Sheet Link"
                >
                    <Input
                        placeholder="https://docs.google.com/..."
                        prefix={<LinkOutlined />}
                    />
                </Form.Item>
            </Col>

            {/* Availability Button */}
            <Col xs={24} md={8}>
                <Form.Item label=" ">
                    {availabilityLink ? (
                        <Button
                            type="primary"
                            ghost
                            icon={<LinkOutlined />}
                            href={availabilityLink}
                            target="_blank"
                            block
                        >
                            Check Availability
                        </Button>
                    ) : (
                        <Text type="secondary" className="text-xs block pt-2">
                            Enter an availability link to enable the button
                        </Text>
                    )}
                </Form.Item>
            </Col>

            {/* Payment Plan Toggle */}
            <Col span={24}>
                <div className="flex items-center gap-3 mb-4 mt-2">
                    <Text strong>Payment Plan</Text>
                    <Switch
                        checked={paymentPlanEnabled}
                        onChange={handlePaymentPlanToggle}
                        checkedChildren="Yes"
                        unCheckedChildren="No"
                    />
                </div>
            </Col>

            {/* Payment Plan Sub-fields */}
            {paymentPlanEnabled && (
                <>
                    {/* Downpayment Type */}
                    <Col xs={24} md={6}>
                        <Form.Item
                            name={["payment_plan", "downpayment_type"]}
                            label="Downpayment Type"
                        >
                            <Select
                                placeholder="Select type"
                                options={DOWNPAYMENT_TYPE_OPTIONS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                            />
                        </Form.Item>
                    </Col>

                    {/* Downpayment Value */}
                    <Col xs={24} md={6}>
                        <Form.Item
                            name={["payment_plan", "downpayment_value"]}
                            label={
                                paymentPlan?.downpayment_type === "percentage"
                                    ? "Downpayment (%)"
                                    : "Downpayment Amount"
                            }
                        >
                            <InputNumber
                                min={0}
                                max={
                                    paymentPlan?.downpayment_type ===
                                    "percentage"
                                        ? 100
                                        : undefined
                                }
                                placeholder={
                                    paymentPlan?.downpayment_type ===
                                    "percentage"
                                        ? "e.g. 35"
                                        : "e.g. 30000"
                                }
                                style={{ width: "100%" }}
                                addonAfter={
                                    paymentPlan?.downpayment_type ===
                                    "percentage"
                                        ? "%"
                                        : "£"
                                }
                            />
                        </Form.Item>
                    </Col>

                    {/* Period in Months */}
                    <Col xs={24} md={6}>
                        <Form.Item
                            name={["payment_plan", "period_months"]}
                            label="Period (Months)"
                        >
                            <InputNumber
                                min={1}
                                max={360}
                                placeholder="e.g. 60"
                                style={{ width: "100%" }}
                                addonAfter="months"
                            />
                        </Form.Item>
                    </Col>

                    {/* Interest Rate */}
                    <Col xs={24} md={6}>
                        <Form.Item
                            name={["payment_plan", "interest_rate"]}
                            label="Interest Rate"
                        >
                            <InputNumber
                                min={0}
                                max={100}
                                step={0.1}
                                placeholder="e.g. 0"
                                style={{ width: "100%" }}
                                addonAfter="%"
                            />
                        </Form.Item>
                    </Col>
                </>
            )}
        </Row>
    );
};

export default ConstructionProjectPricingSection;
