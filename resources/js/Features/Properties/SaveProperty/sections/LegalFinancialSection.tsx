import React from "react";
import {
    Form,
    Select,
    Input,
    InputNumber,
    Switch,
    Row,
    Col,
    Divider,
    Typography,
    Radio,
    Checkbox,
} from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory, PropertyEnumValues } from "@/Types";
import {
    RENTAL_PERIOD_OPTIONS,
    PAYMENT_INTERVAL_OPTIONS,
} from "../fieldConfig";
import { useFormOptions } from "../useFormOptions";

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface LegalFinancialSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    enumValues?: PropertyEnumValues;
}

const LegalFinancialSection: React.FC<LegalFinancialSectionProps> = ({
    form,
    primaryCategory,
    enumValues,
}) => {
    const { deedTypeOptions, deedStatusOptions } = useFormOptions(
        enumValues,
        primaryCategory,
    );
    const saleType = Form.useWatch("sale_type", form);
    const isRental = saleType === "For Rent" || saleType === "For Daily Rental";
    const isLand = primaryCategory === "land";

    // Shared watchers (used by both land and non-land)
    const hasPaymentPlan = Form.useWatch(
        ["legal_info", "has_payment_plan"],
        form,
    );
    const downpaymentIsPercentage = Form.useWatch(
        ["legal_info", "downpayment_is_percentage"],
        form,
    );
    const hasRestrictions = Form.useWatch(
        ["legal_info", "has_restrictions"],
        form,
    );

    return (
        <div>
            {/* ============================== */}
            {/* Title Deed — all categories */}
            {/* ============================== */}
            <Text strong className="text-sm block mb-3">
                Title Deed Information
            </Text>
            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item name="title_deed_type" label="Deed Type">
                        <Select placeholder="Select deed type" allowClear>
                            {deedTypeOptions.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item name="title_deed_stage" label="Deed Status">
                        <Select placeholder="Select status" allowClear>
                            {deedStatusOptions.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            </Row>

            {/* ============================== */}
            {/* NON-LAND: residential / commercial */}
            {/* ============================== */}
            {!isLand && (
                <>
                    {/* Rental terms — only when sale_type is rental */}
                    {isRental && (
                        <>
                            <Divider className="!my-3" />
                            <Text strong className="text-sm block mb-3">
                                Rental Terms
                            </Text>
                            <Row gutter={[16, 0]}>
                                <Col xs={24} md={8}>
                                    <Form.Item
                                        name="minimal_rental_period"
                                        label="Minimum Rental Period"
                                    >
                                        <Select
                                            placeholder="Select period"
                                            allowClear
                                        >
                                            {RENTAL_PERIOD_OPTIONS.map((o) => (
                                                <Option
                                                    key={o.value}
                                                    value={o.value}
                                                >
                                                    {o.label}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Form.Item
                                        name="rent_payment_interval"
                                        label="Payment Interval"
                                    >
                                        <Select
                                            placeholder="Select interval"
                                            allowClear
                                        >
                                            {PAYMENT_INTERVAL_OPTIONS.map(
                                                (o) => (
                                                    <Option
                                                        key={o.value}
                                                        value={o.value}
                                                    >
                                                        {o.label}
                                                    </Option>
                                                ),
                                            )}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                        </>
                    )}

                    {/* ---------- Financial Details ---------- */}
                    <Divider className="!my-3" />
                    <Text strong className="text-sm block mb-3">
                        Financial Details
                    </Text>
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "deposit_amount"]}
                                label="Deposit Amount"
                            >
                                <InputNumber
                                    min={0}
                                    placeholder="0"
                                    style={{ width: "100%" }}
                                    formatter={(value) =>
                                        `${value}`.replace(
                                            /\B(?=(\d{3})+(?!\d))/g,
                                            ",",
                                        )
                                    }
                                    parser={
                                        ((value: string | undefined) =>
                                            Number(
                                                value?.replace(/,/g, "") || 0,
                                            )) as any
                                    }
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "mortgage_eligible"]}
                                label="Mortgage Eligible"
                                valuePropName="checked"
                            >
                                <Switch
                                    checkedChildren="Yes"
                                    unCheckedChildren="No"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* ---------- Legal Details ---------- */}
                    <Divider className="!my-3" />
                    <Text strong className="text-sm block mb-3">
                        Legal Details
                    </Text>

                    {/* Payment Plan */}
                    <Row gutter={[16, 0]} align="middle">
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "has_payment_plan"]}
                                label="Payment Plan"
                                valuePropName="checked"
                            >
                                <Switch
                                    checkedChildren="Yes"
                                    unCheckedChildren="No"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {hasPaymentPlan && (
                        <Row gutter={[16, 0]}>
                            <Col xs={24} md={8}>
                                <Form.Item label="Downpayment">
                                    <Input.Group compact>
                                        <Form.Item
                                            name={[
                                                "legal_info",
                                                "downpayment_value",
                                            ]}
                                            noStyle
                                        >
                                            <InputNumber
                                                min={0}
                                                placeholder="0"
                                                style={{
                                                    width: "calc(100% - 80px)",
                                                }}
                                                formatter={
                                                    downpaymentIsPercentage
                                                        ? undefined
                                                        : (value) =>
                                                              `${value}`.replace(
                                                                  /\B(?=(\d{3})+(?!\d))/g,
                                                                  ",",
                                                              )
                                                }
                                                parser={
                                                    downpaymentIsPercentage
                                                        ? undefined
                                                        : (((
                                                              value:
                                                                  | string
                                                                  | undefined,
                                                          ) =>
                                                              Number(
                                                                  value?.replace(
                                                                      /,/g,
                                                                      "",
                                                                  ) || 0,
                                                              )) as any)
                                                }
                                                max={
                                                    downpaymentIsPercentage
                                                        ? 100
                                                        : undefined
                                                }
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name={[
                                                "legal_info",
                                                "downpayment_is_percentage",
                                            ]}
                                            noStyle
                                            valuePropName="checked"
                                        >
                                            <Switch
                                                checkedChildren="%"
                                                unCheckedChildren="Amt"
                                                style={{ marginLeft: 8 }}
                                            />
                                        </Form.Item>
                                    </Input.Group>
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    name={[
                                        "legal_info",
                                        "payment_period_months",
                                    ]}
                                    label="Period"
                                >
                                    <InputNumber
                                        min={1}
                                        placeholder="0"
                                        style={{ width: "100%" }}
                                        addonAfter="months"
                                    />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    name={["legal_info", "interest_rate"]}
                                    label="Interest"
                                >
                                    <InputNumber
                                        min={0}
                                        max={100}
                                        placeholder="0"
                                        style={{ width: "100%" }}
                                        addonAfter="%"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}

                    {/* Military distance */}
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name={["legal_info", "military_distance"]}
                                label="Distance to Military Base"
                            >
                                <Input placeholder="e.g. 2 km" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Restrictions */}
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "has_restrictions"]}
                                label="Any Restrictions"
                            >
                                <Radio.Group>
                                    <Radio value={true}>Yes</Radio>
                                    <Radio value={false}>No</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        {hasRestrictions && (
                            <Col xs={24} md={16}>
                                <Form.Item
                                    name={["legal_info", "restriction_notes"]}
                                    label="Restriction Details"
                                >
                                    <TextArea
                                        rows={2}
                                        placeholder="Describe restrictions..."
                                    />
                                </Form.Item>
                            </Col>
                        )}
                    </Row>

                    {/* Payment plan additional notes */}
                    <Row gutter={[16, 0]}>
                        <Col span={24}>
                            <Form.Item
                                name={["legal_info", "payment_plan_notes"]}
                                label="Payment Plan Additional Notes"
                            >
                                <TextArea
                                    rows={2}
                                    placeholder="Additional notes about payment plan..."
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </>
            )}

            {/* ============================== */}
            {/* LAND: new layout */}
            {/* ============================== */}
            {isLand && (
                <>
                    {/* ---------- Finance ---------- */}
                    <Divider className="!my-3" />
                    <Text strong className="text-sm block mb-3">
                        Finance
                    </Text>
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "development_rate"]}
                                label="Development Rate"
                            >
                                <InputNumber
                                    min={0}
                                    max={100}
                                    placeholder="0"
                                    style={{ width: "100%" }}
                                    addonAfter="%"
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "max_floor_permission"]}
                                label="Max Floor Permission"
                            >
                                <InputNumber
                                    min={0}
                                    placeholder="0"
                                    style={{ width: "100%" }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* VAT & Tax */}
                    <Text type="secondary" className="text-xs block mb-2 mt-1">
                        VAT & Tax
                    </Text>
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name={["legal_info", "vat_paid"]}
                                label="VAT Status"
                            >
                                <Radio.Group>
                                    <Radio value={true}>VAT Paid (5%)</Radio>
                                    <Radio value={false}>VAT Not Paid</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item
                                name={["legal_info", "trafo_paid"]}
                                valuePropName="checked"
                                label=" "
                            >
                                <Checkbox>Trafo Fee Paid</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item
                                name={["legal_info", "stopaj_paid"]}
                                valuePropName="checked"
                                label=" "
                            >
                                <Checkbox>
                                    Stopaj (Withholding Tax) Paid
                                </Checkbox>
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* ---------- Legal Details ---------- */}
                    <Divider className="!my-3" />
                    <Text strong className="text-sm block mb-3">
                        Legal Details
                    </Text>

                    {/* Payment Plan */}
                    <Row gutter={[16, 0]} align="middle">
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "has_payment_plan"]}
                                label="Payment Plan"
                                valuePropName="checked"
                            >
                                <Switch
                                    checkedChildren="Yes"
                                    unCheckedChildren="No"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {hasPaymentPlan && (
                        <Row gutter={[16, 0]}>
                            <Col xs={24} md={8}>
                                <Form.Item label="Downpayment">
                                    <Input.Group compact>
                                        <Form.Item
                                            name={[
                                                "legal_info",
                                                "downpayment_value",
                                            ]}
                                            noStyle
                                        >
                                            <InputNumber
                                                min={0}
                                                placeholder="0"
                                                style={{
                                                    width: "calc(100% - 80px)",
                                                }}
                                                formatter={
                                                    downpaymentIsPercentage
                                                        ? undefined
                                                        : (value) =>
                                                              `${value}`.replace(
                                                                  /\B(?=(\d{3})+(?!\d))/g,
                                                                  ",",
                                                              )
                                                }
                                                parser={
                                                    downpaymentIsPercentage
                                                        ? undefined
                                                        : (((
                                                              value:
                                                                  | string
                                                                  | undefined,
                                                          ) =>
                                                              Number(
                                                                  value?.replace(
                                                                      /,/g,
                                                                      "",
                                                                  ) || 0,
                                                              )) as any)
                                                }
                                                max={
                                                    downpaymentIsPercentage
                                                        ? 100
                                                        : undefined
                                                }
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name={[
                                                "legal_info",
                                                "downpayment_is_percentage",
                                            ]}
                                            noStyle
                                            valuePropName="checked"
                                        >
                                            <Switch
                                                checkedChildren="%"
                                                unCheckedChildren="Amt"
                                                style={{ marginLeft: 8 }}
                                            />
                                        </Form.Item>
                                    </Input.Group>
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    name={[
                                        "legal_info",
                                        "payment_period_months",
                                    ]}
                                    label="Period"
                                >
                                    <InputNumber
                                        min={1}
                                        placeholder="0"
                                        style={{ width: "100%" }}
                                        addonAfter="months"
                                    />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    name={["legal_info", "interest_rate"]}
                                    label="Interest"
                                >
                                    <InputNumber
                                        min={0}
                                        max={100}
                                        placeholder="0"
                                        style={{ width: "100%" }}
                                        addonAfter="%"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}

                    {/* Military distance */}
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name={["legal_info", "military_distance"]}
                                label="Distance to Military Base"
                            >
                                <Input placeholder="e.g. 2 km" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Restrictions */}
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "has_restrictions"]}
                                label="Any Restrictions"
                            >
                                <Radio.Group>
                                    <Radio value={true}>Yes</Radio>
                                    <Radio value={false}>No</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        {hasRestrictions && (
                            <Col xs={24} md={16}>
                                <Form.Item
                                    name={["legal_info", "restriction_notes"]}
                                    label="Restriction Details"
                                >
                                    <TextArea
                                        rows={2}
                                        placeholder="Describe restrictions..."
                                    />
                                </Form.Item>
                            </Col>
                        )}
                    </Row>

                    {/* Payment plan additional notes */}
                    <Row gutter={[16, 0]}>
                        <Col span={24}>
                            <Form.Item
                                name={["legal_info", "payment_plan_notes"]}
                                label="Payment Plan Additional Notes"
                            >
                                <TextArea
                                    rows={2}
                                    placeholder="Additional notes about payment plan..."
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </>
            )}
        </div>
    );
};

export default LegalFinancialSection;
