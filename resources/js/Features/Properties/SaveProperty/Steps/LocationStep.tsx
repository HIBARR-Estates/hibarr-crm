import React, { useMemo, useState, useEffect } from "react";
import {
    Form,
    Input,
    Select,
    AutoComplete,
    Row,
    Col,
    Card,
    Typography,
    Divider,
    Alert,
} from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues } from "@/Types";
import { usePage } from "@inertiajs/react";
import { EnvironmentOutlined, GlobalOutlined } from "@ant-design/icons";

const { Option } = Select;
const { Text } = Typography;

interface LocationStepProps {
    form: FormInstance;
    enumValues?: PropertyEnumValues;
    data?: Partial<Property>;
}

interface DeveloperProject {
    id: number;
    name: string;
    location?: { id: number; name: string } | null;
}

interface ProjectLocation {
    id: number;
    name: string;
}

export default function LocationStep({
    form,
    enumValues,
    data,
}: LocationStepProps) {
    const { props } = usePage<any>();
    const developerProjects = (props?.developerProjects ||
        []) as DeveloperProject[];
    const projectLocations = (props?.projectLocations ||
        []) as ProjectLocation[];
    const cities = enumValues?.cities || [];

    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
        data?.developer_project_id ?? null,
    );

    // Update local state when form value changes
    useEffect(() => {
        const projectId = form.getFieldValue("developer_project_id");
        setSelectedProjectId(projectId ?? null);
    }, [form]);

    // Find selected project and check if it has a location
    const selectedProject = useMemo(() => {
        if (!selectedProjectId) return null;
        return (
            developerProjects.find((p) => p.id === selectedProjectId) ?? null
        );
    }, [selectedProjectId, developerProjects]);

    const projectHasLocation = useMemo(() => {
        return (
            selectedProject?.location !== undefined &&
            selectedProject?.location !== null
        );
    }, [selectedProject]);

    return (
        <Card size="small" className="border-0 shadow-none">
            <Text type="secondary" className="block mb-4">
                <EnvironmentOutlined className="mr-2" />
                Specify the property's location details including city, area,
                and address.
            </Text>

            <Row gutter={[16, 0]}>
                {/* Show current project info if selected */}
                {selectedProject && (
                    <Col span={24}>
                        <Alert
                            message={`Linked to project: ${selectedProject.name}${projectHasLocation ? ` — Location: ${selectedProject.location?.name}` : ""}`}
                            type="info"
                            showIcon
                            className="mb-4"
                        />
                    </Col>
                )}

                {/* Direct Project Location - only show if project has no location */}
                {!projectHasLocation && (
                    <Col span={24}>
                        <Form.Item
                            name="project_location_id"
                            label="Project Location"
                            tooltip="Select a predefined project location for this property"
                        >
                            <Select
                                placeholder="Select project location"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {projectLocations.map((location) => (
                                    <Option
                                        key={location.id}
                                        value={location.id}
                                    >
                                        {location.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                )}

                {/* City and Area */}
                <Col xs={24} md={12}>
                    <Form.Item
                        name="city"
                        label="City"
                        tooltip={
                            projectHasLocation
                                ? "Derived from project location"
                                : undefined
                        }
                    >
                        <AutoComplete
                            placeholder={
                                projectHasLocation
                                    ? "From project location"
                                    : "Select or enter city"
                            }
                            allowClear
                            disabled={projectHasLocation}
                            className={projectHasLocation ? "bg-gray-50" : ""}
                            options={cities.map((city) => ({
                                value: city,
                                label: city,
                            }))}
                            filterOption={(inputValue, option) =>
                                option?.value
                                    ?.toLowerCase()
                                    .includes(inputValue.toLowerCase()) ?? false
                            }
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="area"
                        label="Area / District"
                        tooltip={
                            projectHasLocation
                                ? "Derived from project location"
                                : undefined
                        }
                    >
                        <Input
                            placeholder={
                                projectHasLocation
                                    ? "From project location"
                                    : "Enter area or district name"
                            }
                            disabled={projectHasLocation}
                            className={projectHasLocation ? "bg-gray-50" : ""}
                        />
                    </Form.Item>
                </Col>

                {/* Full Address */}
                <Col span={24}>
                    <Form.Item
                        name="address"
                        label="Full Address"
                        tooltip="Complete street address (optional)"
                    >
                        <Input.TextArea
                            rows={2}
                            placeholder="Enter full street address..."
                        />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Divider className="my-2">
                        <GlobalOutlined className="mr-2" />
                        GPS Coordinates (Optional)
                    </Divider>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="latitude"
                        label="Latitude"
                        rules={[
                            {
                                type: "number",
                                min: -90,
                                max: 90,
                                message: "Latitude must be between -90 and 90",
                                transform: (value) =>
                                    value ? Number(value) : undefined,
                            },
                        ]}
                    >
                        <Input
                            type="number"
                            step="0.000001"
                            placeholder="e.g., 36.8969"
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="longitude"
                        label="Longitude"
                        rules={[
                            {
                                type: "number",
                                min: -180,
                                max: 180,
                                message:
                                    "Longitude must be between -180 and 180",
                                transform: (value) =>
                                    value ? Number(value) : undefined,
                            },
                        ]}
                    >
                        <Input
                            type="number"
                            step="0.000001"
                            placeholder="e.g., 30.7133"
                        />
                    </Form.Item>
                </Col>
            </Row>
        </Card>
    );
}
