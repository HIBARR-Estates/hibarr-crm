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
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
    const saleType = Form.useWatch("sale_type", form);
    const isRental = saleType?.includes("Rent");

    return (
        <Card size="small" className="border-0 shadow-none">
            {/* Legal Information */}
            <Text type="secondary" className="block mb-4">
                <FileTextOutlined className="mr-2" />
                {td("Legal documentation and title deed information.", { source: "en" })}
            </Text>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                    <Form.Item name="title_deed_type" label={td("Title Deed Type", { source: "en" })}>
                        <Select placeholder={td("Select deed type", { source: "en" })} allowClear>
                            {DEED_TYPES.map((type) => (
                                <Option key={type} value={type}>
                                    {type}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item name="title_deed_stage" label={td("Title Deed Stage", { source: "en" })}>
                        <Select placeholder={td("Select deed stage", { source: "en" })} allowClear>
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
                        label={td("Deed Type (Detailed)", { source: "en" })}
                    >
                        <Input placeholder={td("e.g., Kat Mülkiyeti", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["legal_info", "deed_status"]}
                        label={td("Deed Status", { source: "en" })}
                    >
                        <Select placeholder={td("Select status", { source: "en" })} allowClear>
                            <Option value="ready">{td("Ready", { source: "en" })}</Option>
                            <Option value="in_progress">{td("In Progress", { source: "en" })}</Option>
                            <Option value="pending">{td("Pending", { source: "en" })}</Option>
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["legal_info", "iskan_status"]}
                        label={td("Iskan Status", { source: "en" })}
                        tooltip={td("Habitation permit status", { source: "en" })}
                    >
                        <Input placeholder={td("e.g., Received, Pending", { source: "en" })} />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name={["legal_info", "building_permit"]}
                        label={td("Building Permit", { source: "en" })}
                    >
                        <Input placeholder={td("Permit number or status", { source: "en" })} />
                    </Form.Item>
                </Col>
            </Row>

            {/* Rental-specific fields */}
            {isRental && (
                <>
                    <Divider className="my-4">{td("Rental Terms", { source: "en" })}</Divider>
                    <Row gutter={[16, 0]}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="minimal_rental_period"
                                label={td("Minimum Rental Period", { source: "en" })}
                            >
                                <Select
                                    placeholder={td("Select minimum period", { source: "en" })}
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
                                label={td("Payment Interval", { source: "en" })}
                            >
                                <Select
                                    placeholder={td("Select payment interval", { source: "en" })}
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
                {td("Financial Information", { source: "en" })}
            </Divider>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={["financial_info", "commission_rate"]}
                        label={td("Commission Rate (%)", { source: "en" })}
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
                        label={td("Deposit Amount", { source: "en" })}
                    >
                        <InputNumber
                            placeholder={td("Deposit", { source: "en" })}
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
                        label={td("Mortgage Eligible", { source: "en" })}
                        valuePropName="checked"
                    >
                        <Switch checkedChildren="Yes" unCheckedChildren="No" />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item
                        name={["financial_info", "payment_terms"]}
                        label={td("Payment Terms", { source: "en" })}
                    >
                        <TextArea
                            rows={2}
                            placeholder={td("Describe payment terms, installment options, etc.", { source: "en" })}
                        />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item
                        name={["financial_info", "notes"]}
                        label={td("Financial Notes", { source: "en" })}
                    >
                        <TextArea
                            rows={2}
                            placeholder={td("Any additional financial notes or conditions...", { source: "en" })}
                        />
                    </Form.Item>
                </Col>
            </Row>
        </Card>
    );
}
