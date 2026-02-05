import React from "react";
import { Form, Input, Select, Row, Col, Card } from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues } from "@/Types";
import { usePage } from "@inertiajs/react";
import CurrencyInput from "@/Components/CurrencyInput";

const { Option } = Select;
const { TextArea } = Input;

// Property type categories for better organization
const PROPERTY_CATEGORIES = {
    housing: {
        label: "Housing",
        types: [
            "Villa",
            "Twin Villa",
            "Apartment",
            "Family Home",
            "Townhouse",
            "Loft",
            "Penthouse",
            "Bungalow",
            "Commercial Property",
            "Block of apartments",
            "Complete Building",
            "Abandoned Building",
            "Residence",
            "Half Construction",
            "Time Share",
        ],
    },
    land: {
        label: "Land",
        types: [
            "Residentially Zoned Land",
            "Field",
            "Residentially and Commercially Zoned Land",
            "Commercially Zoned Land",
            "Industrially Zoned land",
            "Tourism Zoned Land",
            "Olive Grove",
        ],
    },
    commercial: {
        label: "Commercial Real Estate",
        types: [
            "Shop",
            "Hotel",
            "Workplace",
            "Warehouse",
            "Workplace for sale",
            "Office",
        ],
    },
};

const SALE_TYPES = ["For Sale", "For Rent", "For Daily Rental"];
const STATUS_OPTIONS = [
    "Available",
    "Under offer",
    "Sold",
    "Withdrawn",
    "Rented",
    "Reserved",
    "Let agreed",
    "Sale agreed",
];

interface BasicInfoStepProps {
    form: FormInstance;
    enumValues?: PropertyEnumValues;
    data?: Partial<Property>;
}

export default function BasicInfoStep({
    form,
    enumValues,
    data,
}: BasicInfoStepProps) {
    const { props } = usePage<any>();

    return (
        <Card size="small" className="border-0 shadow-none">
            <Row gutter={[16, 0]}>
                {/* <Col span={24}>
                    <Form.Item
                        name="title"
                        label="Property Title"
                        tooltip="A descriptive title for the property. If left blank, a reference code will be generated automatically."
                    >
                        <Input placeholder="Enter property title (optional - reference code will be auto-generated)" />
                    </Form.Item>
                </Col> */}

                <Col xs={24} md={12}>
                    <Form.Item
                        name="property_type"
                        label="Property Type"
                        rules={[
                            {
                                required: true,
                                message: "Please select property type",
                            },
                        ]}
                    >
                        <Select
                            placeholder="Select property type"
                            showSearch
                            optionFilterProp="children"
                        >
                            {Object.entries(PROPERTY_CATEGORIES).map(
                                ([key, category]) => (
                                    <Select.OptGroup
                                        key={key}
                                        label={category.label}
                                    >
                                        {category.types.map((type) => (
                                            <Option key={type} value={type}>
                                                {type}
                                            </Option>
                                        ))}
                                    </Select.OptGroup>
                                ),
                            )}
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="sale_type"
                        label="Sale Type"
                        rules={[
                            {
                                required: true,
                                message: "Please select sale type",
                            },
                        ]}
                    >
                        <Select placeholder="Select sale type">
                            {SALE_TYPES.map((type) => (
                                <Option key={type} value={type}>
                                    {type}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="price"
                        label="Price"
                        rules={[
                            {
                                required: true,
                                message: "Please enter price",
                            },
                        ]}
                    >
                        <CurrencyInput
                            placeholder="Enter price"
                            showLabel={false}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="status"
                        label="Status"
                        initialValue="Available"
                    >
                        <Select placeholder="Select status">
                            {STATUS_OPTIONS.map((status) => (
                                <Option key={status} value={status}>
                                    {status}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item
                        name="description"
                        label="Description"
                        tooltip="A detailed description of the property. This is optional."
                    >
                        <TextArea
                            rows={4}
                            placeholder="Describe the property features, condition, and any notable details..."
                        />
                    </Form.Item>
                </Col>
            </Row>
        </Card>
    );
}
