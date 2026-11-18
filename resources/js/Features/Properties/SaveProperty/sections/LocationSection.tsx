import React, { useEffect, useMemo, useRef } from "react";
import {
    Form,
    Select,
    Input,
    InputNumber,
    Row,
    Col,
    Alert,
    Divider,
} from "antd";
import type { FormInstance } from "antd/lib/form";
import type {
    CityLookupValue,
    PrimaryCategory,
    PropertyEnumValues,
} from "@/Types";
import { usePage } from "@inertiajs/react";
import { DISTANCE_FIELDS } from "../constructionProjectConfig";
import { formatLocationNameForDisplay } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { TextArea } = Input;

interface LocationSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    enumValues?: PropertyEnumValues;
}

interface DeveloperProject {
    id: number;
    name: string;
    location?: { id: number; name: string } | null;
    project_location_id?: number;
}

interface ProjectLocation {
    id: number;
    name: string;
}

const LocationSection: React.FC<LocationSectionProps> = ({
    form,
    primaryCategory,
    enumValues,
}) => {
    const { td } = useTd();
    const { props } = usePage<any>();
    const developerProjects = (props?.developerProjects ||
        []) as DeveloperProject[];
    const projectLocations = (props?.projectLocations ||
        []) as ProjectLocation[];

    const developerProjectId = Form.useWatch("developer_project_id", form);

    // Find selected project
    const selectedProject = useMemo(() => {
        if (!developerProjectId) return null;
        return (
            developerProjects.find((p) => p.id === developerProjectId) || null
        );
    }, [developerProjectId, developerProjects]);

    const hasProjectLocation = !!selectedProject?.location;

    // Watch city value for area filtering
    const selectedCity = Form.useWatch("city", form);

    // City select options — derived from DB lookup values
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

    // Clear area only when the user changes city (not on initial hydrate).
    const previousCityRef = useRef<string | undefined | null>(undefined);
    const hydratedRef = useRef(false);
    useEffect(() => {
        if (!hydratedRef.current) {
            if (selectedCity != null && selectedCity !== "") {
                previousCityRef.current = selectedCity;
                hydratedRef.current = true;
            }
            return;
        }
        if (previousCityRef.current === selectedCity) return;
        previousCityRef.current = selectedCity;
        form.setFieldValue("area", undefined);
    }, [selectedCity, form]);

    // Auto-fill distance fields from city defaults (only empty fields)
    const isInitialCity = useRef(true);
    useEffect(() => {
        if (isInitialCity.current) {
            isInitialCity.current = false;
            return;
        }
        if (!selectedCity || !enumValues?.cities) return;
        const cityObj = enumValues.cities.find(
            (c: CityLookupValue) => c.name === selectedCity,
        );
        const defaults = cityObj?.default_distances;
        if (!defaults) return;

        DISTANCE_FIELDS.forEach((field) => {
            const current = form.getFieldValue(["distances", field.key]);
            if (current == null || current === "") {
                const defaultVal = defaults[field.key as keyof typeof defaults];
                if (defaultVal != null) {
                    form.setFieldValue(["distances", field.key], defaultVal);
                }
            }
        });
    }, [selectedCity, enumValues?.cities, form]);

    return (
        <Row gutter={[16, 0]}>
            {/* Project location info */}
            {hasProjectLocation && (
                <Col span={24}>
                    <Alert
                        message={`Location inherited from project: ${formatLocationNameForDisplay(selectedProject?.location?.name)}`}
                        type="info"
                        showIcon
                        className="mb-3"
                    />
                </Col>
            )}

            {/* Project Location — show if project has no location */}
            {developerProjectId && !hasProjectLocation && (
                <Col xs={24} md={12}>
                    <Form.Item
                        name="project_location_id"
                        label={td("Project Location", { source: "en" })}
                    >
                        <Select
                            placeholder={td("Select location", { source: "en" })}
                            allowClear
                            showSearch
                            optionFilterProp="children"
                        >
                            {projectLocations.map((loc) => (
                                <Select.Option key={loc.id} value={loc.id}>
                                    {formatLocationNameForDisplay(loc.name)}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}

            {/* City */}
            <Col xs={24} md={12}>
                <Form.Item name="city" label={td("City", { source: "en" })}>
                    <Select
                        options={cityOptions}
                        placeholder={td("Select city", { source: "en" })}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        disabled={hasProjectLocation}
                    />
                </Form.Item>
            </Col>

            {/* Area / District */}
            <Col xs={24} md={12}>
                <Form.Item name="area" label={td("Area / District", { source: "en" })}>
                    <Select
                        options={areaOptions}
                        placeholder={
                            selectedCity ? "Select area" : "Select a city first"
                        }
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        disabled={hasProjectLocation || !selectedCity}
                    />
                </Form.Item>
            </Col>

            {/* Address */}
            <Col span={24}>
                <Form.Item name="address" label={td("Full Address", { source: "en" })}>
                    <TextArea
                        rows={2}
                        placeholder={td("Street address or description", { source: "en" })}
                    />
                </Form.Item>
            </Col>

            {/* Block Name — not applicable for land */}
            {primaryCategory !== "land" && (
                <Col xs={12} md={6}>
                    <Form.Item name="block_name" label={td("Block Name", { source: "en" })}>
                        <Input placeholder={td("e.g. Block A", { source: "en" })} />
                    </Form.Item>
                </Col>
            )}

            {/* Unit Number — not applicable for land */}
            {primaryCategory !== "land" && (
                <Col xs={12} md={6}>
                    <Form.Item name="unit_number" label={td("Unit Number", { source: "en" })}>
                        <Input placeholder="e.g. 301" />
                    </Form.Item>
                </Col>
            )}

            {/* Latitude */}
            <Col xs={12} md={6}>
                <Form.Item
                    name="latitude"
                    label={td("Latitude", { source: "en" })}
                    rules={[
                        {
                            type: "number",
                            min: -90,
                            max: 90,
                            message: "Must be between -90 and 90",
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
                    label={td("Longitude", { source: "en" })}
                    rules={[
                        {
                            type: "number",
                            min: -180,
                            max: 180,
                            message: "Must be between -180 and 180",
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
            <Col span={24}>
                <Form.Item name="map" label={td("Map URL / Embed Link", { source: "en" })}>
                    <Input placeholder={td("Google Maps link or embed URL", { source: "en" })} />
                </Form.Item>
            </Col>

            {/* Distances to Amenities */}
            <Col span={24}>
                <Divider orientation="left" plain>
                    {td("Distances to Amenities (km)", { source: "en" })}
                </Divider>
            </Col>
            {DISTANCE_FIELDS.map((field) => (
                <Col xs={12} md={8} key={field.key}>
                    <Form.Item
                        name={["distances", field.key]}
                        label={field.label}
                    >
                        <InputNumber
                            placeholder="0.0"
                            style={{ width: "100%" }}
                            min={0}
                            step={0.1}
                            addonAfter="km"
                        />
                    </Form.Item>
                </Col>
            ))}
        </Row>
    );
};

export default LocationSection;
