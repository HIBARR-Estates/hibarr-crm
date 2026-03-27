import React, { useEffect, useMemo, useRef } from "react";
import { Form, Select, Input, InputNumber, Row, Col, Alert } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PropertyEnumValues } from "@/Types";
import { usePage } from "@inertiajs/react";
import { DISTANCE_FIELDS } from "../constructionProjectConfig";
import { DeveloperProject } from "@/Types/developerProject";

const { TextArea } = Input;

interface ConstructionProjectLocationSectionProps {
    form: FormInstance;
    enumValues?: PropertyEnumValues;
    project?: DeveloperProject | null;
}

/**
 * Location section for construction projects.
 *
 * Same as the standard LocationSection but:
 * - Excludes Block Name and Unit Number (project-level, not unit-level)
 * - Includes distance input fields (markets, hospitals, airports, schools, beaches)
 */
const ConstructionProjectLocationSection: React.FC<
    ConstructionProjectLocationSectionProps
> = ({ form, enumValues, project }) => {
    const { props } = usePage<any>();

    // Watch city value for area filtering
    const selectedCity = Form.useWatch("city", form);

    // City select options
    const cityOptions = useMemo(() => {
        const cities = enumValues?.cities || [];
        return cities.map((c) => ({
            value: c.name,
            label: c.label,
        }));
    }, [enumValues?.cities]);

    // Area options filtered by selected city
    const areaOptions = useMemo(() => {
        if (!selectedCity || !enumValues?.areas_by_city) return [];
        const areas = enumValues.areas_by_city[selectedCity] || [];
        return areas.map((a) => ({
            value: a.name,
            label: a.label,
        }));
    }, [selectedCity, enumValues?.areas_by_city]);

    // Clear area when city changes (but not on initial form population)
    const isInitialCity = useRef(true);
    useEffect(() => {
        if (isInitialCity.current) {
            isInitialCity.current = false;
            return;
        }
        form.setFieldValue("area", undefined);
    }, [selectedCity]);

    return (
        <Row gutter={[16, 0]}>
            {/* City */}
            <Col xs={24} md={12}>
                <Form.Item name="city" label="City">
                    <Select
                        options={cityOptions}
                        placeholder="Select city"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                    />
                </Form.Item>
            </Col>

            {/* Area / District */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="area"
                    label="Area / District"
                    initialValue={project?.location?.area}
                >
                    <Select
                        options={areaOptions}
                        placeholder={
                            selectedCity ? "Select area" : "Select a city first"
                        }
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        disabled={!selectedCity}
                    />
                </Form.Item>
            </Col>

            {/* Address */}
            <Col span={24}>
                <Form.Item name="address" label="Full Address">
                    <TextArea
                        rows={2}
                        placeholder="Street address or description"
                    />
                </Form.Item>
            </Col>

            {/* Latitude */}
            <Col xs={12} md={6}>
                <Form.Item
                    name="latitude"
                    label="Latitude"
                    rules={[
                        {
                            type: "number",
                            // min: -90,
                            // max: 90,
                            // message: "Must be between -90 and 90",
                            transform: (v: string) =>
                                v ? Number(v) : undefined,
                        },
                    ]}
                >
                    <InputNumber
                        placeholder="35.1856"
                        style={{ width: "100%" }}
                        step={0.0001}
                    />
                </Form.Item>
            </Col>

            {/* Longitude */}
            <Col xs={12} md={6}>
                <Form.Item
                    name="longitude"
                    label="Longitude"
                    rules={[
                        {
                            type: "number",
                            // min: -180,
                            // max: 180,
                            // message: "Must be between -180 and 180",
                            transform: (v: string) =>
                                v ? Number(v) : undefined,
                        },
                    ]}
                >
                    <InputNumber
                        placeholder="33.3823"
                        style={{ width: "100%" }}
                        step={0.0001}
                    />
                </Form.Item>
            </Col>

            {/* Map URL */}
            <Col xs={24} md={12}>
                <Form.Item name="map_url" label="Map URL">
                    <Input placeholder="Google Maps link" />
                </Form.Item>
            </Col>

            {/* ======================== */}
            {/* Distance Fields */}
            {/* ======================== */}
            <Col span={24}>
                <div className="mt-2 mb-2 border-t pt-3">
                    <span className="text-sm font-medium text-gray-700">
                        Distances (km)
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                        Approximate driving distance
                    </span>
                </div>
            </Col>

            {DISTANCE_FIELDS.map((field) => (
                <Col xs={12} md={8} key={field.key}>
                    <Form.Item
                        name={["distances", field.key]}
                        label={field.label}
                    >
                        <InputNumber
                            min={0}
                            max={500}
                            step={0.1}
                            placeholder="km"
                            style={{ width: "100%" }}
                            addonAfter="km"
                        />
                    </Form.Item>
                </Col>
            ))}
        </Row>
    );
};

export default ConstructionProjectLocationSection;
