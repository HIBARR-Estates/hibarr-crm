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
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface LegalFinancialSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    enumValues?: PropertyEnumValues;
    lockedFields?: Set<string>;
    /** Active currency code from the form-level currency picker */
    selectedCurrency?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    TRY: "₺",
};

const LegalFinancialSection: React.FC<LegalFinancialSectionProps> = ({
    form,
    primaryCategory,
    enumValues,
    lockedFields = new Set<string>(),
    selectedCurrency = "GBP",
}) => {
    const { td } = useTd();
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
                {td("Title Deed Information", { source: "en" })}
            </Text>
            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item name="title_deed_type" label={td("Deed Type", { source: "en" })}>
                        <Select placeholder={td("Select deed type", { source: "en" })} allowClear>
                            {deedTypeOptions.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item name="title_deed_stage" label={td("Deed Status", { source: "en" })}>
                        <Select placeholder={td("Select status", { source: "en" })} allowClear>
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
            {/* VAT & Tax — all categories */}
            {/* ============================== */}
            <Divider className="!my-3" />
            <Text type="secondary" className="text-xs block mb-2 mt-1">
                VAT & Tax
            </Text>
            <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name={["legal_info", "vat_paid"]}
                        label={td("VAT Status", { source: "en" })}
                    >
                        <Radio.Group>
                            <Radio value={true}>{td("VAT Paid (5%)", { source: "en" })}</Radio>
                            <Radio value={false}>{td("VAT Not Paid", { source: "en" })}</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                    <Form.Item
                        name={["legal_info", "trafo_paid"]}
                        valuePropName="checked"
                        label=" "
                    >
                        <Checkbox>{td("Trafo Fee Paid", { source: "en" })}</Checkbox>
                    </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                    <Form.Item
                        name={["legal_info", "stopaj_paid"]}
                        valuePropName="checked"
                        label=" "
                    >
                        <Checkbox>{td("Stopaj (Withholding Tax) Paid", { source: "en" })}</Checkbox>
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
                                {td("Rental Terms", { source: "en" })}
                            </Text>
                            <Row gutter={[16, 0]}>
                                <Col xs={24} md={8}>
                                    <Form.Item
                                        name="minimal_rental_period"
                                        label={td("Minimum Rental Period", { source: "en" })}
                                    >
                                        <Select
                                            placeholder={td("Select period", { source: "en" })}
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
                                        label={td("Payment Interval", { source: "en" })}
                                    >
                                        <Select
                                            placeholder={td("Select interval", { source: "en" })}
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
                        {td("Financial Details", { source: "en" })}
                    </Text>
                    <Row gutter={[16, 0]}>
                        {/* Deposit — only for rentals, not for sale */}
                        {isRental && (
                            <Col xs={24} md={8}>
                                <Form.Item
                                    name={["legal_info", "deposit_amount"]}
                                    label={td("Deposit Amount", { source: "en" })}
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
                                                    value?.replace(/,/g, "") ||
                                                        0,
                                                )) as any
                                        }
                                    />
                                </Form.Item>
                            </Col>
                        )}
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "mortgage_eligible"]}
                                label={td("Mortgage Eligible", { source: "en" })}
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
                        {td("Legal Details", { source: "en" })}
                    </Text>

                    {/* Payment Plan */}
                    <Row gutter={[16, 0]} align="middle">
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "has_payment_plan"]}
                                label={td("Payment Plan", { source: "en" })}
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
                                <Form.Item label={td("Downpayment", { source: "en" })}>
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
                                                unCheckedChildren={
                                                    CURRENCY_SYMBOLS[
                                                        selectedCurrency
                                                    ] || selectedCurrency
                                                }
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
                                    label={td("Period", { source: "en" })}
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
                                    label={td("Interest", { source: "en" })}
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
                                label={td("Distance to Military Base", { source: "en" })}
                            >
                                <Input placeholder={td("e.g. 2 km", { source: "en" })} />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Restrictions */}
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "has_restrictions"]}
                                label={td("Any Restrictions", { source: "en" })}
                            >
                                <Radio.Group
                                    disabled={lockedFields.has(
                                        "legal_info.has_restrictions",
                                    )}
                                >
                                    <Radio value={true}>{td("Yes", { source: "en" })}</Radio>
                                    <Radio value={false}>{td("No", { source: "en" })}</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        {hasRestrictions && (
                            <Col xs={24} md={16}>
                                <Form.Item
                                    name={["legal_info", "restriction_notes"]}
                                    label={td("Restriction Details", { source: "en" })}
                                >
                                    <TextArea
                                        rows={2}
                                        placeholder={td("Describe restrictions...", { source: "en" })}
                                        disabled={lockedFields.has(
                                            "legal_info.restriction_notes",
                                        )}
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
                                label={td("Payment Plan Additional Notes", { source: "en" })}
                            >
                                <TextArea
                                    rows={2}
                                    placeholder={td("Additional notes about payment plan...", { source: "en" })}
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
                        {td("Finance", { source: "en" })}
                    </Text>
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "development_rate"]}
                                label={td("Development Rate", { source: "en" })}
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
                                label={td("Max Floor Permission", { source: "en" })}
                            >
                                <InputNumber
                                    min={0}
                                    placeholder="0"
                                    style={{ width: "100%" }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* ---------- Legal Details ---------- */}
                    <Divider className="!my-3" />
                    <Text strong className="text-sm block mb-3">
                        {td("Legal Details", { source: "en" })}
                    </Text>

                    {/* Payment Plan */}
                    <Row gutter={[16, 0]} align="middle">
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "has_payment_plan"]}
                                label={td("Payment Plan", { source: "en" })}
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
                                <Form.Item label={td("Downpayment", { source: "en" })}>
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
                                                unCheckedChildren={
                                                    CURRENCY_SYMBOLS[
                                                        selectedCurrency
                                                    ] || selectedCurrency
                                                }
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
                                    label={td("Period", { source: "en" })}
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
                                    label={td("Interest", { source: "en" })}
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
                                label={td("Distance to Military Base", { source: "en" })}
                            >
                                <Input placeholder={td("e.g. 2 km", { source: "en" })} />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Restrictions */}
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name={["legal_info", "has_restrictions"]}
                                label={td("Any Restrictions", { source: "en" })}
                            >
                                <Radio.Group
                                    disabled={lockedFields.has(
                                        "legal_info.has_restrictions",
                                    )}
                                >
                                    <Radio value={true}>{td("Yes", { source: "en" })}</Radio>
                                    <Radio value={false}>{td("No", { source: "en" })}</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        {hasRestrictions && (
                            <Col xs={24} md={16}>
                                <Form.Item
                                    name={["legal_info", "restriction_notes"]}
                                    label={td("Restriction Details", { source: "en" })}
                                >
                                    <TextArea
                                        rows={2}
                                        placeholder={td("Describe restrictions...", { source: "en" })}
                                        disabled={lockedFields.has(
                                            "legal_info.restriction_notes",
                                        )}
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
                                label={td("Payment Plan Additional Notes", { source: "en" })}
                            >
                                <TextArea
                                    rows={2}
                                    placeholder={td("Additional notes about payment plan...", { source: "en" })}
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
