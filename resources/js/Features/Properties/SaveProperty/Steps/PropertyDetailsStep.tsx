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
    DatePicker,
} from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues } from "@/Types";
import {
    HomeOutlined,
    ExpandOutlined,
    CalendarOutlined,
} from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Option } = Select;
const { Text } = Typography;

interface PropertyDetailsStepProps {
    form: FormInstance;
    enumValues?: PropertyEnumValues;
    data?: Partial<Property>;
}

const FURNITURE_STATUS_OPTIONS = [
    "Furnished",
    "Semi-Furnished",
    "Unfurnished",
    "White Goods Only",
];

const HEATING_TYPES = [
    "Central",
    "Underfloor",
    "Air Conditioning",
    "Natural Gas",
    "Electric",
    "Solar",
    "None",
];

export default function PropertyDetailsStep({
    form,
    enumValues,
    data,
}: PropertyDetailsStepProps) {
    const { td } = useTd();
    return (
        <Card size="small" className="border-0 shadow-none">
            {/* Room Configuration */}
            <Text type="secondary" className="block mb-4">
                <HomeOutlined className="mr-2" />
                Specify the property's room configuration and physical details.
            </Text>

            <Row gutter={[16, 0]}>
                <Col xs={12} md={6}>
                    <Form.Item
                        name="rooms"
                        label={td("Total Rooms", { source: "en" })}
                        tooltip={td("Total number of rooms (e.g., 3+1 = 4)", { source: "en" })}
                    >
                        <InputNumber
                            placeholder={td("Total", { source: "en" })}
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item
                        name="floors_in_building"
                        label={td("Floors in Building", { source: "en" })}
                    >
                        <InputNumber
                            placeholder={td("Building floors", { source: "en" })}
                            min={1}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item
                        name="floor_number"
                        label={td("Floor Number", { source: "en" })}
                        tooltip={td("Which floor is this unit on", { source: "en" })}
                    >
                        <InputNumber
                            placeholder={td("Floor #", { source: "en" })}
                            min={-5}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item name="balcony_count" label={td("Balconies", { source: "en" })}>
                        <InputNumber
                            placeholder={td("Count", { source: "en" })}
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item name="balcony_net_sqm" label={td("Balcony Size (m²)", { source: "en" })}>
                        <InputNumber
                            placeholder="m²"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Divider className="my-4">
                <ExpandOutlined className="mr-2" />
                Size & Measurements
            </Divider>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item
                        name="living_area_sqm"
                        label={td("Living Area (m²)", { source: "en" })}
                        tooltip={td("Usable interior space", { source: "en" })}
                    >
                        <InputNumber
                            placeholder={td("Net m²", { source: "en" })}
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                    <Form.Item
                        name="gross_sqm"
                        label={td("Gross Area (m²)", { source: "en" })}
                        tooltip={td("Total area including walls", { source: "en" })}
                    >
                        <InputNumber
                            placeholder={td("Gross m²", { source: "en" })}
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                    <Form.Item
                        name="land_size"
                        label={td("Land Size (m²)", { source: "en" })}
                        tooltip={td("For villas/land properties", { source: "en" })}
                    >
                        <InputNumber
                            placeholder={td("Land m²", { source: "en" })}
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Divider className="my-4">{td("Property Condition", { source: "en" })}</Divider>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item name="building_age" label={td("Building Age (years)", { source: "en" })}>
                        <InputNumber
                            placeholder={td("Age", { source: "en" })}
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                    <Form.Item name="furniture_status" label={td("Furniture Status", { source: "en" })}>
                        <Select
                            placeholder={td("Select furniture status", { source: "en" })}
                            allowClear
                        >
                            {FURNITURE_STATUS_OPTIONS.map((status) => (
                                <Option key={status} value={status}>
                                    {status}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                    <Form.Item name="heating_type" label={td("Heating Type", { source: "en" })}>
                        <Select placeholder={td("Select heating type", { source: "en" })} allowClear>
                            {HEATING_TYPES.map((type) => (
                                <Option key={type} value={type}>
                                    {type}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="completion_date"
                        label={td("Completion Date", { source: "en" })}
                        tooltip={td("For off-plan or under construction properties", { source: "en" })}
                    >
                        <DatePicker
                            placeholder={td("Select completion date", { source: "en" })}
                            style={{ width: "100%" }}
                            format="YYYY-MM-DD"
                        />
                    </Form.Item>
                </Col>
            </Row>
        </Card>
    );
}
