import React from "react";
import { Form, Checkbox, Row, Col, Typography, Divider } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory, PropertyEnumValues } from "@/Types";
import { useFormOptions } from "../useFormOptions";

const { Text } = Typography;

interface FeaturesSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    enumValues?: PropertyEnumValues;
    lockedFields?: Set<string>;
}

/**
 * Features section: interior, exterior, location features, and add-ons.
 * All options sourced from the database via enumValues.
 * Hidden entirely for land category (controlled by CATEGORY_SECTIONS).
 */
const FeaturesSection: React.FC<FeaturesSectionProps> = ({
    form,
    primaryCategory,
    enumValues,
    lockedFields = new Set<string>(),
}) => {
    const {
        interiorFeatureOptions,
        exteriorFeatureOptions,
        locationFeatureOptions,
        addOnOptions,
    } = useFormOptions(enumValues, primaryCategory);

    return (
        <div className="space-y-5">
            {/* Interior Features */}
            <div>
                <Text strong className="text-sm block mb-2">
                    Interior Features
                </Text>
                <Form.Item name="interior_features" noStyle>
                    <Checkbox.Group className="w-full" disabled={lockedFields.has('interior_features')}>
                        <Row gutter={[8, 4]}>
                            {interiorFeatureOptions.map((o) => (
                                <Col xs={12} sm={8} md={6} key={o.value}>
                                    <Checkbox
                                        value={o.value}
                                        className="text-xs"
                                    >
                                        {o.label}
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
                    <Checkbox.Group className="w-full" disabled={lockedFields.has('exterior_features')}>
                        <Row gutter={[8, 4]}>
                            {exteriorFeatureOptions.map((o) => (
                                <Col xs={12} sm={8} md={6} key={o.value}>
                                    <Checkbox
                                        value={o.value}
                                        className="text-xs"
                                    >
                                        {o.label}
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
                            {locationFeatureOptions.map((o) => (
                                <Col xs={12} sm={8} md={6} key={o.value}>
                                    <Checkbox
                                        value={o.value}
                                        className="text-xs"
                                    >
                                        {o.label}
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
                            {addOnOptions.map((o) => (
                                <Col xs={12} sm={8} md={6} key={o.value}>
                                    <Checkbox
                                        value={o.value}
                                        className="text-xs"
                                    >
                                        {o.label}
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
