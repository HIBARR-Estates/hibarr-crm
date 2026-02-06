import React from "react";
import {
    Form,
    Input,
    InputNumber,
    Select,
    Row,
    Col,
    Card,
    Typography,
    Divider,
    Switch,
} from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues } from "@/Types";
import {
    FileTextOutlined,
    DollarOutlined,
    SafetyOutlined,
} from "@ant-design/icons";

const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

interface LegalFinancialStepProps {
    form: FormInstance;
    enumValues?: PropertyEnumValues;
    data?: Partial<Property>;
}

const DEED_TYPES = [
    "Freehold",
    "Leasehold",
    "Exchange (Kat Irtifakı)",
    "Full Ownership (Kat Mülkiyeti)",
    "Shared Title",
    "Floor Easement",
    "Land Registry",
];

const DEED_STATUSES = [
    "Ready",
    "In Progress",
    "Pending",
    "Applied",
    "Under Review",
];

const PAYMENT_INTERVALS = [
    "Monthly",
    "Quarterly",
    "Bi-Annually",
    "Annually",
    "Weekly",
    "Daily",
];

const RENTAL_PERIODS = [
    "6 Months",
    "12 Months",
    "24 Months",
    "36 Months",
    "Flexible",
];

export default function LegalFinancialStep({
    form,
    enumValues,
    data,
}: LegalFinancialStepProps) {
    const saleType = Form.useWatch("sale_type", form);
    const isRental = saleType?.includes("Rent");

    return (
        <Card size="small" className="border-0 shadow-none">
            {/* Legal Information */}
            <Text type="secondary" className="block mb-4">
                <FileTextOutlined className="mr-2" />
                Legal documentation and title deed information.
            </Text>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                    <Form.Item name="title_deed_type" label="Title Deed Type">
                        <Select placeholder="Select deed type" allowClear>
                            {DEED_TYPES.map((type) => (
                                <Option key={type} value={type}>
                                    {type}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item name="title_deed_stage" label="Title Deed Stage">
                        <Select placeholder="Select deed stage" allowClear>
                            {DEED_STATUSES.map((status) => (
                                <Option key={status} value={status}>
                                    {status}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                {/* Nested legal_info JSON fields */}
                <Col xs={24} md={12}>
                    <Form.Item
                        name={["legal_info", "deed_type"]}
                        label="Deed Type (Detailed)"
                    >
                        <Input placeholder="e.g., Kat Mülkiyeti" />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["legal_info", "deed_status"]}
                        label="Deed Status"
                    >
                        <Select placeholder="Select status" allowClear>
                            <Option value="ready">Ready</Option>
                            <Option value="in_progress">In Progress</Option>
                            <Option value="pending">Pending</Option>
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["legal_info", "iskan_status"]}
                        label="Iskan Status"
                        tooltip="Habitation permit status"
                    >
                        <Input placeholder="e.g., Received, Pending" />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["legal_info", "building_permit"]}
                        label="Building Permit"
                    >
                        <Input placeholder="Permit number or status" />
                    </Form.Item>
                </Col>
            </Row>

            {/* Rental-specific fields */}
            {isRental && (
                <>
                    <Divider className="my-4">Rental Terms</Divider>
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="minimal_rental_period"
                                label="Minimum Rental Period"
                            >
                                <Select
                                    placeholder="Select minimum period"
                                    allowClear
                                >
                                    {RENTAL_PERIODS.map((period) => (
                                        <Option key={period} value={period}>
                                            {period}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                name="rent_payment_interval"
                                label="Payment Interval"
                            >
                                <Select
                                    placeholder="Select payment interval"
                                    allowClear
                                >
                                    {PAYMENT_INTERVALS.map((interval) => (
                                        <Option key={interval} value={interval}>
                                            {interval}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </>
            )}

            <Divider className="my-4">
                <DollarOutlined className="mr-2" />
                Financial Information
            </Divider>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["financial_info", "commission_rate"]}
                        label="Commission Rate (%)"
                    >
                        <InputNumber
                            placeholder="e.g., 3"
                            min={0}
                            max={100}
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
                            placeholder="Deposit"
                            min={0}
                            style={{ width: "100%" }}
                            formatter={(value) =>
                                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                            parser={(value) =>
                                Number(value?.replace(/,/g, "") || 0) as 0
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
                            placeholder="Describe payment terms, installment options, etc."
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
                            placeholder="Any additional financial notes or conditions..."
                        />
                    </Form.Item>
                </Col>
            </Row>
        </Card>
    );
}
