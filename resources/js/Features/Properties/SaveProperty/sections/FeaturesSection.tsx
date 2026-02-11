import React from "react";
import { Form, Checkbox, Row, Col, Typography, Divider } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import {
    INTERIOR_FEATURES,
    EXTERIOR_FEATURES,
    LOCATION_FEATURES,
    ADD_ON_OPTIONS,
} from "../fieldConfig";

const { Text } = Typography;

interface FeaturesSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
}

/**
 * Features section: interior, exterior, location features, and add-ons.
 * Hidden entirely for land category (controlled by CATEGORY_SECTIONS).
 */
const FeaturesSection: React.FC<FeaturesSectionProps> = ({
    form,
    primaryCategory,
}) => {
    return (
        <div className="space-y-5">
            {/* Interior Features */}
            <div>
                <Text strong className="text-sm block mb-2">
                    Interior Features
                </Text>
                <Form.Item name="interior_features" noStyle>
                    <Checkbox.Group className="w-full">
                        <Row gutter={[8, 4]}>
                            {INTERIOR_FEATURES.map((feature) => (
                                <Col xs={12} sm={8} md={6} key={feature}>
                                    <Checkbox
                                        value={feature}
                                        className="text-xs"
                                    >
                                        {feature}
                                    </Checkbox>
                                </Col>
                            ))}
                        </Row>
                    </Checkbox.Group>
                </Form.Item>
            </div>

            <Divider className="!my-3" />

            {/* Exterior Features */}
            <div>
                <Text strong className="text-sm block mb-2">
                    Exterior Features
                </Text>
                <Form.Item name="exterior_features" noStyle>
                    <Checkbox.Group className="w-full">
                        <Row gutter={[8, 4]}>
                            {EXTERIOR_FEATURES.map((feature) => (
                                <Col xs={12} sm={8} md={6} key={feature}>
                                    <Checkbox
                                        value={feature}
                                        className="text-xs"
                                    >
                                        {feature}
                                    </Checkbox>
                                </Col>
                            ))}
                        </Row>
                    </Checkbox.Group>
                </Form.Item>
            </div>

            <Divider className="!my-3" />

            {/* Location Features */}
            <div>
                <Text strong className="text-sm block mb-2">
                    Location Features
                </Text>
                <Form.Item name="location_features" noStyle>
                    <Checkbox.Group className="w-full">
                        <Row gutter={[8, 4]}>
                            {LOCATION_FEATURES.map((feature) => (
                                <Col xs={12} sm={8} md={6} key={feature}>
                                    <Checkbox
                                        value={feature}
                                        className="text-xs"
                                    >
                                        {feature}
                                    </Checkbox>
                                </Col>
                            ))}
                        </Row>
                    </Checkbox.Group>
                </Form.Item>
            </div>

            <Divider className="!my-3" />

            {/* Add-Ons */}
            <div>
                <Text strong className="text-sm block mb-2">
                    Add-Ons & Extras
                </Text>
                <Form.Item name="add_ons" noStyle>
                    <Checkbox.Group className="w-full">
                        <Row gutter={[8, 4]}>
                            {ADD_ON_OPTIONS.map((option) => (
                                <Col xs={12} sm={8} md={6} key={option}>
                                    <Checkbox
                                        value={option}
                                        className="text-xs"
                                    >
                                        {option}
                                    </Checkbox>
                                </Col>
                            ))}
                        </Row>
                    </Checkbox.Group>
                </Form.Item>
            </div>
        </div>
    );
};

export default FeaturesSection;
