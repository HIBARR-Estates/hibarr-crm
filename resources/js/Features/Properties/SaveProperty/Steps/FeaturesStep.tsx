import React, { useEffect, useState } from "react";
import { Form, Checkbox, Row, Col, Card, Typography, Divider } from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues, PrimaryCategory } from "@/Types";
import {
    HomeOutlined,
    CarOutlined,
    EnvironmentOutlined,
    GiftOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

interface FeaturesStepProps {
    form: FormInstance;
    enumValues?: PropertyEnumValues;
    data?: Partial<Property>;
}

// Feature options
const INTERIOR_FEATURES = [
    "Air Conditioning",
    "Central Heating",
    "Underfloor Heating",
    "Fireplace",
    "Built-in Wardrobes",
    "Walk-in Closet",
    "Smart Home System",
    "Security System",
    "Intercom",
    "Satellite TV",
    "Internet Connection",
    "Jacuzzi",
    "Sauna",
    "Wine Cellar",
    "Home Cinema",
    "Laundry Room",
    "Storage Room",
    "Guest WC",
    "En-suite Bathroom",
    "Dressing Room",
    "Open Kitchen",
    "Fitted Kitchen",
    "Pantry",
    "Utility Room",
];

const EXTERIOR_FEATURES = [
    "Private Pool",
    "Shared Pool",
    "Infinity Pool",
    "Garden",
    "Private Garden",
    "Terrace",
    "Balcony",
    "Roof Terrace",
    "Parking",
    "Private Parking",
    "Underground Parking",
    "Garage",
    "Security",
    "24/7 Security",
    "CCTV",
    "Gated Community",
    "Children's Playground",
    "Tennis Court",
    "Basketball Court",
    "BBQ Area",
    "Outdoor Kitchen",
    "Beach Access",
    "Boat Dock",
    "Elevator",
    "Concierge",
    "Gym",
    "Fitness Center",
    "SPA",
    "Turkish Bath",
    "Sauna",
    "Steam Room",
    "Landscaped Gardens",
];

const LOCATION_FEATURES = [
    "Sea View",
    "Mountain View",
    "City View",
    "Pool View",
    "Garden View",
    "Forest View",
    "Lake View",
    "River View",
    "Near Beach",
    "Beachfront",
    "Near Airport",
    "Near Highway",
    "Near Public Transport",
    "Near School",
    "Near Hospital",
    "Near Shopping Mall",
    "Near Golf Course",
    "Near Marina",
    "City Center",
    "Quiet Location",
    "Rural Setting",
    "Gated Community",
    "Resort Complex",
];

const ADD_ONS = [
    "Furniture Package",
    "White Goods",
    "Appliances",
    "Curtains & Blinds",
    "Light Fixtures",
    "Garden Furniture",
    "Pool Equipment",
    "Maintenance Contract",
    "Property Management",
    "Rental Management",
    "Hotel Service",
    "Title Deed Transfer",
    "Legal Support",
    "Bank Account Setup",
    "Residency Support",
    "Airport Transfer",
];

export default function FeaturesStep({
    form,
    enumValues,
    data,
}: FeaturesStepProps) {
    const [selectedCategory, setSelectedCategory] =
        useState<PrimaryCategory | null>(
            (data?.primary_category as PrimaryCategory) ?? null,
        );

    // Watch primary_category from the form
    useEffect(() => {
        const category = form.getFieldValue("primary_category");
        setSelectedCategory(category ?? null);
    }, [form]);

    const isLand = selectedCategory === "land";

    // Clear non-location features when switching to land
    useEffect(() => {
        if (isLand) {
            form.setFieldValue("interior_features", []);
            form.setFieldValue("exterior_features", []);
            form.setFieldValue("add_ons", []);
        }
    }, [isLand, form]);

    return (
        <Card size="small" className="border-0 shadow-none">
            <Text type="secondary" className="block mb-4">
                Select all features and amenities that apply to this property.
            </Text>

            <Row gutter={[16, 0]}>
                {/* Interior Features - hidden for land */}
                {!isLand && (
                    <>
                        <Col span={24}>
                            <Form.Item
                                name="interior_features"
                                label={
                                    <span>
                                        <HomeOutlined className="mr-2" />
                                        Interior Features
                                    </span>
                                }
                            >
                                <Checkbox.Group style={{ width: "100%" }}>
                                    <Row gutter={[8, 4]}>
                                        {INTERIOR_FEATURES.map((feature) => (
                                            <Col
                                                xs={24}
                                                sm={12}
                                                md={8}
                                                key={feature}
                                            >
                                                <Checkbox value={feature}>
                                                    {feature}
                                                </Checkbox>
                                            </Col>
                                        ))}
                                    </Row>
                                </Checkbox.Group>
                            </Form.Item>
                        </Col>

                        <Col span={24}>
                            <Divider className="my-2" />
                        </Col>

                        {/* Exterior Features */}
                        <Col span={24}>
                            <Form.Item
                                name="exterior_features"
                                label={
                                    <span>
                                        <CarOutlined className="mr-2" />
                                        Exterior Features & Amenities
                                    </span>
                                }
                            >
                                <Checkbox.Group style={{ width: "100%" }}>
                                    <Row gutter={[8, 4]}>
                                        {EXTERIOR_FEATURES.map((feature) => (
                                            <Col
                                                xs={24}
                                                sm={12}
                                                md={8}
                                                key={feature}
                                            >
                                                <Checkbox value={feature}>
                                                    {feature}
                                                </Checkbox>
                                            </Col>
                                        ))}
                                    </Row>
                                </Checkbox.Group>
                            </Form.Item>
                        </Col>

                        <Col span={24}>
                            <Divider className="my-2" />
                        </Col>
                    </>
                )}

                {/* Location Features - always shown */}
                <Col span={24}>
                    <Form.Item
                        name="location_features"
                        label={
                            <span>
                                <EnvironmentOutlined className="mr-2" />
                                Location Features & Proximity
                            </span>
                        }
                    >
                        <Checkbox.Group style={{ width: "100%" }}>
                            <Row gutter={[8, 4]}>
                                {LOCATION_FEATURES.map((feature) => (
                                    <Col xs={24} sm={12} md={8} key={feature}>
                                        <Checkbox value={feature}>
                                            {feature}
                                        </Checkbox>
                                    </Col>
                                ))}
                            </Row>
                        </Checkbox.Group>
                    </Form.Item>
                </Col>

                {/* Add-ons - hidden for land */}
                {!isLand && (
                    <>
                        <Col span={24}>
                            <Divider className="my-2" />
                        </Col>

                        <Col span={24}>
                            <Form.Item
                                name="add_ons"
                                label={
                                    <span>
                                        <GiftOutlined className="mr-2" />
                                        Included Add-ons & Services
                                    </span>
                                }
                            >
                                <Checkbox.Group style={{ width: "100%" }}>
                                    <Row gutter={[8, 4]}>
                                        {ADD_ONS.map((addon) => (
                                            <Col
                                                xs={24}
                                                sm={12}
                                                md={8}
                                                key={addon}
                                            >
                                                <Checkbox value={addon}>
                                                    {addon}
                                                </Checkbox>
                                            </Col>
                                        ))}
                                    </Row>
                                </Checkbox.Group>
                            </Form.Item>
                        </Col>
                    </>
                )}
            </Row>
        </Card>
    );
}
