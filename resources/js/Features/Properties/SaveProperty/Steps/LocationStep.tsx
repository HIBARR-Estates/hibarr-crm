import React, { useMemo, useState, useEffect } from "react";
import { Form, Input, Row, Col, Card, Typography, Divider, Alert } from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues } from "@/Types";
import { usePage } from "@inertiajs/react";
import { EnvironmentOutlined, GlobalOutlined } from "@ant-design/icons";

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

export default function LocationStep({
    form,
    enumValues,
    data,
}: LocationStepProps) {
    const { props } = usePage<any>();
    const developerProjects = (props?.developerProjects ||
        []) as DeveloperProject[];

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
                Additional location details. The primary location (city/area)
                was set in Basic Info.
            </Text>

            <Row gutter={[16, 0]}>
                {/* Show current project info if selected */}
                {selectedProject && (
                    <Col span={24}>
                        <Alert
                            message={`Linked to project: ${selectedProject.name}${projectHasLocation ? ` (${selectedProject.location?.name})` : ""}`}
                            type="info"
                            showIcon
                            className="mb-4"
                        />
                    </Col>
                )}

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
