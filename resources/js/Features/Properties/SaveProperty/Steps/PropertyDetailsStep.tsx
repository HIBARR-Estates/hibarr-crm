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
                        label="Total Rooms"
                        tooltip="Total number of rooms (e.g., 3+1 = 4)"
                    >
                        <InputNumber
                            placeholder="Total"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item name="bedrooms" label="Bedrooms">
                        <InputNumber
                            placeholder="Bedrooms"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item name="bathrooms" label="Bathrooms">
                        <InputNumber
                            placeholder="Bathrooms"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item name="living_rooms" label="Living Rooms">
                        <InputNumber
                            placeholder="Living"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item name="total_floors" label="Total Floors">
                        <InputNumber
                            placeholder="Building floors"
                            min={1}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item
                        name="floor"
                        label="Unit Floor"
                        tooltip="Which floor is this unit on"
                    >
                        <InputNumber
                            placeholder="Floor #"
                            min={-5}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item name="balcony_count" label="Balconies">
                        <InputNumber
                            placeholder="Count"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={12} md={6}>
                    <Form.Item name="balcony_net_sqm" label="Balcony Size (m²)">
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
                        name="net_sqm"
                        label="Net Area (m²)"
                        tooltip="Usable interior space"
                    >
                        <InputNumber
                            placeholder="Net m²"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                    <Form.Item
                        name="gross_sqm"
                        label="Gross Area (m²)"
                        tooltip="Total area including walls"
                    >
                        <InputNumber
                            placeholder="Gross m²"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                    <Form.Item
                        name="land_size"
                        label="Land Size (m²)"
                        tooltip="For villas/land properties"
                    >
                        <InputNumber
                            placeholder="Land m²"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Divider className="my-4">Property Condition</Divider>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                    <Form.Item name="building_age" label="Building Age (years)">
                        <InputNumber
                            placeholder="Age"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                    <Form.Item name="furniture_status" label="Furniture Status">
                        <Select
                            placeholder="Select furniture status"
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
                    <Form.Item name="heating_type" label="Heating Type">
                        <Select placeholder="Select heating type" allowClear>
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
                        name="delivery_date"
                        label="Expected Delivery Date"
                        tooltip="For off-plan or under construction properties"
                    >
                        <DatePicker
                            placeholder="Select delivery date"
                            style={{ width: "100%" }}
                            format="YYYY-MM-DD"
                        />
                    </Form.Item>
                </Col>
            </Row>
        </Card>
    );
}
