import React, { useRef, useCallback } from "react";
import { Form, Select, InputNumber, Switch, Row, Col, Typography } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory, PropertyEnumValues } from "@/Types";
import {
    SPECIFICATION_FIELDS,
    BEDROOM_OPTIONS,
    BATHROOM_OPTIONS,
    FLOOR_OPTIONS,
    FLOORS_IN_BUILDING_OPTIONS,
    BUILDING_AGE_OPTIONS,
} from "../fieldConfig";
import { useFormOptions } from "../useFormOptions";

const { Option } = Select;
const { Text } = Typography;

// 1 Dönüm = 1,338 m²
const DONUM_TO_SQM = 1338;

interface SpecificationsSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    enumValues?: PropertyEnumValues;
    lockedFields?: Set<string>;
}

const SpecificationsSection: React.FC<SpecificationsSectionProps> = ({
    form,
    primaryCategory,
    enumValues,
    lockedFields = new Set<string>(),
}) => {
    const fields = SPECIFICATION_FIELDS[primaryCategory];
    const { furnitureStatusOptions, heatingTypeOptions } = useFormOptions(
        enumValues,
        primaryCategory,
    );
    const unitStyle = Form.useWatch("unit_style", form);
    const isStudio = Array.isArray(unitStyle) && unitStyle.includes("studio");

    // Prevent infinite loops during donum ↔ m² conversion
    const isConverting = useRef(false);

    const handleSqmChange = useCallback(
        (value: number | null) => {
            if (isConverting.current) return;
            isConverting.current = true;
            if (value !== null && value > 0) {
                form.setFieldValue(
                    "land_size_donum",
                    Math.round((value / DONUM_TO_SQM) * 10000) / 10000,
                );
            } else {
                form.setFieldValue("land_size_donum", null);
            }
            // Use setTimeout to ensure state is flushed before unlocking
            setTimeout(() => {
                isConverting.current = false;
            }, 0);
        },
        [form],
    );

    const handleDonumChange = useCallback(
        (value: number | null) => {
            if (isConverting.current) return;
            isConverting.current = true;
            if (value !== null && value > 0) {
                form.setFieldValue(
                    "land_size",
                    Math.round(value * DONUM_TO_SQM * 100) / 100,
                );
            } else {
                form.setFieldValue("land_size", null);
            }
            setTimeout(() => {
                isConverting.current = false;
            }, 0);
        },
        [form],
    );

    return (
        <Row gutter={[16, 0]}>
            {/* Gross land/building area */}
            {fields.grossArea && (
                <Col xs={12} md={8}>
                    <Form.Item name="gross_sqm" label="Gross Area (m²)">
                        <InputNumber
                            placeholder="0"
                            min={0}
                            style={{ width: "100%" }}
                            addonAfter="m²"
                            disabled={lockedFields.has('gross_sqm')}
                        />
                    </Form.Item>
                </Col>
            )}

            {/* Usable internal area */}
            {fields.usableArea && (
                <Col xs={12} md={8}>
                    <Form.Item
                        name="living_area_sqm"
                        label="Usable Internal Area (m²)"
                    >
                        <InputNumber
                            placeholder="0"
                            min={0}
                            style={{ width: "100%" }}
                            addonAfter="m²"
                            disabled={lockedFields.has('living_area_sqm')}
                        />
                    </Form.Item>
                </Col>
            )}

            {/* Plot size — land: dual m² / dönüm fields with auto-conversion */}
            {fields.plotSize && (
                <>
                    <Col xs={12} md={8}>
                        <Form.Item name="land_size" label="Plot Size (m²)">
                            <InputNumber
                                placeholder="0"
                                min={0}
                                style={{ width: "100%" }}
                                addonAfter="m²"
                                onChange={handleSqmChange}
                                disabled={lockedFields.has('land_size')}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={8}>
                        <Form.Item
                            name="land_size_donum"
                            label="Plot Size (Dönüm)"
                        >
                            <InputNumber
                                placeholder="0"
                                min={0}
                                step={0.1}
                                style={{ width: "100%" }}
                                addonAfter="dönüm"
                                onChange={handleDonumChange}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8} className="flex items-end pb-6">
                        <Text type="secondary" className="text-xs">
                            1 Dönüm = 1,338 m²
                        </Text>
                    </Col>
                </>
            )}

            {/* Bedrooms */}
            {fields.bedrooms && !isStudio && (
                <Col xs={12} md={6}>
                    <Form.Item name="bedrooms" label="Bedrooms">
                        <Select placeholder="Select" disabled={lockedFields.has('bedrooms')}>
                            {BEDROOM_OPTIONS.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}

            {/* Bathrooms */}
            {fields.bathrooms && (
                <Col xs={12} md={6}>
                    <Form.Item name="bathrooms" label="Bathrooms">
                        <Select placeholder="Select" disabled={lockedFields.has('bathrooms')}>
                            {BATHROOM_OPTIONS.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}

            {/* Living rooms */}
            {fields.livingRoom && !isStudio && (
                <Col xs={12} md={6}>
                    <Form.Item name="living_room" label="Living Rooms">
                        <InputNumber
                            placeholder="0"
                            min={0}
                            max={5}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>
            )}

            {/* Rooms */}
            {fields.rooms && (
                <Col xs={12} md={6}>
                    <Form.Item name="rooms" label="Total Rooms">
                        <InputNumber
                            placeholder="0"
                            min={0}
                            style={{ width: "100%" }}
                        />
                    </Form.Item>
                </Col>
            )}

            {/* Floor */}
            {fields.floorNumber && (
                <Col xs={12} md={6}>
                    <Form.Item name="floor_number" label="Floor">
                        <Select placeholder="Select" allowClear disabled={lockedFields.has('floor_number')}>
                            {FLOOR_OPTIONS.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}

            {/* Floors in building */}
            {fields.floorsInBuilding && (
                <Col xs={12} md={6}>
                    <Form.Item
                        name="floors_in_building"
                        label="Floors in Building"
                    >
                        <Select placeholder="Select" allowClear disabled={lockedFields.has('floors_in_building')}>
                            {FLOORS_IN_BUILDING_OPTIONS.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}

            {/* Building age */}
            {fields.buildingAge && (
                <Col xs={12} md={6}>
                    <Form.Item name="building_age" label="Building Age">
                        <Select placeholder="Select" allowClear>
                            {BUILDING_AGE_OPTIONS.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}

            {/* Balcony / terrace area */}
            {fields.balconyArea && (
                <Col xs={12} md={6}>
                    <Form.Item
                        name="balcony_net_sqm"
                        label="Terrace/Balcony (m²)"
                    >
                        <InputNumber
                            placeholder="0"
                            min={0}
                            style={{ width: "100%" }}
                            addonAfter="m²"
                            disabled={lockedFields.has('balcony_net_sqm')}
                        />
                    </Form.Item>
                </Col>
            )}

            {/* Elevator */}
            {fields.elevator && (
                <Col xs={12} md={6}>
                    <Form.Item
                        name="_has_elevator"
                        label="Elevator"
                        valuePropName="checked"
                    >
                        <Switch checkedChildren="Yes" unCheckedChildren="No" />
                    </Form.Item>
                </Col>
            )}

            {/* Furniture status */}
            {fields.furnitureStatus && (
                <Col xs={12} md={8}>
                    <Form.Item name="furniture_status" label="Furniture Status">
                        <Select placeholder="Select" allowClear disabled={lockedFields.has('furniture_status')}>
                            {furnitureStatusOptions.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}

            {/* Heating type */}
            {fields.heatingType && (
                <Col xs={12} md={8}>
                    <Form.Item name="heating_type" label="Heating Type">
                        <Select placeholder="Select" allowClear>
                            {heatingTypeOptions.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}
        </Row>
    );
};

export default SpecificationsSection;
