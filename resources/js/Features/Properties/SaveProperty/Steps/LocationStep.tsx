import React, { useMemo, useState, useEffect } from "react";
import {
    Form,
    Input,
    Select,
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
    project_location_id?: number;
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

    const handleProjectChange = (value: number | undefined) => {
        setSelectedProjectId(value ?? null);
        // If project has location, clear project_location_id field
        if (value) {
            const project = developerProjects.find((p) => p.id === value);
            if (project?.location) {
                form.setFieldValue("project_location_id", undefined);
            }
        }
    };

    return (
        <Card size="small" className="border-0 shadow-none">
            <Text type="secondary" className="block mb-4">
                <EnvironmentOutlined className="mr-2" />
                Specify the property location. You can link to a developer
                project or set the location directly.
            </Text>

            <Row gutter={[16, 0]}>
                {/* Developer Project Selection */}
                <Col span={24}>
                    <Form.Item
                        name="developer_project_id"
                        label="Developer Project"
                        tooltip="Link this property to a developer project. The project's location will be used if available."
                    >
                        <Select
                            placeholder="Select developer project (optional)"
                            allowClear
                            showSearch
                            optionFilterProp="children"
                            onChange={handleProjectChange}
                        >
                            {developerProjects.map((project) => (
                                <Option key={project.id} value={project.id}>
                                    {project.name}
                                    {project.location && (
                                        <Text type="secondary" className="ml-2">
                                            ({project.location.name})
                                        </Text>
                                    )}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                {/* Show info if project has location */}
                {projectHasLocation && (
                    <Col span={24}>
                        <Alert
                            message={`Location inherited from project: ${selectedProject?.location?.name}`}
                            type="info"
                            showIcon
                            className="mb-4"
                        />
                    </Col>
                )}

                {/* Direct Project Location - only show if no project selected or project has no location */}
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

                <Col span={24}>
                    <Divider className="my-2">Manual Location Details</Divider>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="city"
                        label="City"
                        rules={[
                            {
                                required: true,
                                message: "Please enter or select city",
                            },
                        ]}
                    >
                        <Select
                            placeholder="Select or enter city"
                            allowClear
                            showSearch
                            optionFilterProp="children"
                            mode="tags"
                            maxCount={1}
                        >
                            {cities.map((city) => (
                                <Option key={city} value={city}>
                                    {city}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="area"
                        label="Area / District"
                        rules={[
                            {
                                required: true,
                                message: "Please enter area or district",
                            },
                        ]}
                    >
                        <Input placeholder="Enter area or district name" />
                    </Form.Item>
                </Col>

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
