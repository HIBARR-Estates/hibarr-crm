import React, { useEffect, useMemo } from "react";
import {
    Form,
    Select,
    AutoComplete,
    Input,
    InputNumber,
    Row,
    Col,
    Alert,
} from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory, PropertyEnumValues } from "@/Types";
import { usePage } from "@inertiajs/react";

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

    // City autocomplete options — derived from DB lookup values
    const cityOptions = useMemo(() => {
        const cities = enumValues?.cities || [];
        return cities.map((c) => ({
            value: c.name,
            label: c.label,
        }));
    }, [enumValues?.cities]);

    return (
        <Row gutter={[16, 0]}>
            {/* Project location info */}
            {hasProjectLocation && (
                <Col span={24}>
                    <Alert
                        message={`Location inherited from project: ${selectedProject?.location?.name}`}
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
                        label="Project Location"
                    >
                        <Select
                            placeholder="Select location"
                            allowClear
                            showSearch
                            optionFilterProp="children"
                        >
                            {projectLocations.map((loc) => (
                                <Select.Option key={loc.id} value={loc.id}>
                                    {loc.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}

            {/* City */}
            <Col xs={24} md={12}>
                <Form.Item name="city" label="City">
                    <AutoComplete
                        options={cityOptions}
                        placeholder="Select or type city"
                        filterOption={(input, option) =>
                            (option?.label as string)
                                ?.toLowerCase()
                                .includes(input.toLowerCase()) ?? false
                        }
                        disabled={hasProjectLocation}
                    />
                </Form.Item>
            </Col>

            {/* Area / District */}
            <Col xs={24} md={12}>
                <Form.Item name="area" label="Area / District">
                    <Input
                        placeholder="e.g. Alsancak, Catalkoy"
                        disabled={hasProjectLocation}
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

            {/* Block Name — not applicable for land */}
            {primaryCategory !== "land" && (
                <Col xs={12} md={6}>
                    <Form.Item name="block_name" label="Block Name">
                        <Input placeholder="e.g. Block A" />
                    </Form.Item>
                </Col>
            )}

            {/* Unit Number — not applicable for land */}
            {primaryCategory !== "land" && (
                <Col xs={12} md={6}>
                    <Form.Item name="unit_number" label="Unit Number">
                        <Input placeholder="e.g. 301" />
                    </Form.Item>
                </Col>
            )}

            {/* Latitude */}
            <Col xs={12} md={6}>
                <Form.Item
                    name="latitude"
                    label="Latitude"
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
                    label="Longitude"
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
                <Form.Item name="map" label="Map URL / Embed Link">
                    <Input placeholder="Google Maps link or embed URL" />
                </Form.Item>
            </Col>
        </Row>
    );
};

export default LocationSection;
