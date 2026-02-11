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
} from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import {
    TITLE_DEED_TYPE_OPTIONS,
    RENTAL_PERIOD_OPTIONS,
    PAYMENT_INTERVAL_OPTIONS,
} from "../fieldConfig";

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface LegalFinancialSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
}

const DEED_STATUS_OPTIONS = [
    { value: "ready", label: "Ready" },
    { value: "in_progress", label: "In Progress" },
    { value: "pending", label: "Pending" },
];

const LegalFinancialSection: React.FC<LegalFinancialSectionProps> = ({
    form,
    primaryCategory,
}) => {
    const saleType = Form.useWatch("sale_type", form);
    const isRental = saleType === "For Rent" || saleType === "For Daily Rental";

    return (
        <div>
            {/* Title Deed */}
            <Text strong className="text-sm block mb-3">
                Title Deed Information
            </Text>
            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item name="title_deed_type" label="Deed Type">
                        <Select placeholder="Select deed type" allowClear>
                            {TITLE_DEED_TYPE_OPTIONS.map((o) => (
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
                            {DEED_STATUS_OPTIONS.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            </Row>

            {/* Legal info nested fields */}
            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["legal_info", "deed_type"]}
                        label="Deed Type (Detail)"
                    >
                        <Input placeholder="Additional deed type detail" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["legal_info", "deed_status"]}
                        label="Legal Status"
                    >
                        <Select placeholder="Select" allowClear>
                            {DEED_STATUS_OPTIONS.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["legal_info", "iskan_status"]}
                        label="İskan (Habitation Permit)"
                    >
                        <Input placeholder="Enter status" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["legal_info", "building_permit"]}
                        label="Building Permit"
                    >
                        <Input placeholder="Enter permit info" />
                    </Form.Item>
                </Col>
            </Row>

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
                                <Select placeholder="Select period" allowClear>
                                    {RENTAL_PERIOD_OPTIONS.map((o) => (
                                        <Option key={o.value} value={o.value}>
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
                                    {PAYMENT_INTERVAL_OPTIONS.map((o) => (
                                        <Option key={o.value} value={o.value}>
                                            {o.label}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </>
            )}

            {/* Financial info */}
            <Divider className="!my-3" />
            <Text strong className="text-sm block mb-3">
                Financial Details
            </Text>
            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["financial_info", "commission_rate"]}
                        label="Commission Rate (%)"
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
                        name={["financial_info", "deposit_amount"]}
                        label="Deposit Amount"
                    >
                        <InputNumber
                            min={0}
                            placeholder="0"
                            style={{ width: "100%" }}
                            formatter={(value) =>
                                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
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
                        name={["financial_info", "mortgage_eligible"]}
                        label="Mortgage Eligible"
                        valuePropName="checked"
                    >
                        <Switch checkedChildren="Yes" unCheckedChildren="No" />
                    </Form.Item>
                </Col>
                <Col span={24}>
                    <Form.Item
                        name={["financial_info", "payment_terms"]}
                        label="Payment Terms"
                    >
                        <TextArea
                            rows={2}
                            placeholder="Describe payment plan or terms..."
                        />
                    </Form.Item>
                </Col>
                <Col span={24}>
                    <Form.Item
                        name={["financial_info", "notes"]}
                        label="Financial Notes"
                    >
                        <TextArea
                            rows={2}
                            placeholder="Additional financial notes..."
                        />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    );
};

export default LegalFinancialSection;
