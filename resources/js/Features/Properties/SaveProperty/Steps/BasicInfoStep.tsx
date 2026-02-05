import React, { useMemo, useState, useEffect } from "react";
import {
    Form,
    Input,
    Select,
    Row,
    Col,
    Card,
    AutoComplete,
    Divider,
    Alert,
} from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues } from "@/Types";
import { usePage } from "@inertiajs/react";
import CurrencyInput from "@/Components/CurrencyInput";
import { EnvironmentOutlined } from "@ant-design/icons";

const { Option } = Select;
const { TextArea } = Input;

// Property type categories for better organization
const PROPERTY_CATEGORIES = {
    housing: {
        label: "Housing",
        types: [
            "Villa",
            "Twin Villa",
            "Apartment",
            "Family Home",
            "Townhouse",
            "Loft",
            "Penthouse",
            "Bungalow",
            "Commercial Property",
            "Block of apartments",
            "Complete Building",
            "Abandoned Building",
            "Residence",
            "Half Construction",
            "Time Share",
        ],
    },
    land: {
        label: "Land",
        types: [
            "Residentially Zoned Land",
            "Field",
            "Residentially and Commercially Zoned Land",
            "Commercially Zoned Land",
            "Industrially Zoned land",
            "Tourism Zoned Land",
            "Olive Grove",
        ],
    },
    commercial: {
        label: "Commercial Real Estate",
        types: [
            "Shop",
            "Hotel",
            "Workplace",
            "Warehouse",
            "Workplace for sale",
            "Office",
        ],
    },
};

const SALE_TYPES = ["For Sale", "For Rent", "For Daily Rental"];
const STATUS_OPTIONS = [
    "Available",
    "Under offer",
    "Sold",
    "Withdrawn",
    "Rented",
    "Reserved",
    "Let agreed",
    "Sale agreed",
];

interface BasicInfoStepProps {
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

export default function BasicInfoStep({
    form,
    enumValues,
    data,
}: BasicInfoStepProps) {
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
    };

    return (
        <Card size="small" className="border-0 shadow-none">
            <Row gutter={[16, 0]}>
                {/* <Col span={24}>
                    <Form.Item
                        name="title"
                        label="Property Title"
                        tooltip="A descriptive title for the property. If left blank, a reference code will be generated automatically."
                    >
                        <Input placeholder="Enter property title (optional - reference code will be auto-generated)" />
                    </Form.Item>
                </Col> */}

                <Col xs={24} md={12}>
                    <Form.Item
                        name="property_type"
                        label="Property Type"
                        rules={[
                            {
                                required: true,
                                message: "Please select property type",
                            },
                        ]}
                    >
                        <Select
                            placeholder="Select property type"
                            showSearch
                            optionFilterProp="children"
                        >
                            {Object.entries(PROPERTY_CATEGORIES).map(
                                ([key, category]) => (
                                    <Select.OptGroup
                                        key={key}
                                        label={category.label}
                                    >
                                        {category.types.map((type) => (
                                            <Option key={type} value={type}>
                                                {type}
                                            </Option>
                                        ))}
                                    </Select.OptGroup>
                                ),
                            )}
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="sale_type"
                        label="Sale Type"
                        rules={[
                            {
                                required: true,
                                message: "Please select sale type",
                            },
                        ]}
                    >
                        <Select placeholder="Select sale type">
                            {SALE_TYPES.map((type) => (
                                <Option key={type} value={type}>
                                    {type}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="price"
                        label="Price"
                        rules={[
                            {
                                required: true,
                                message: "Please enter price",
                            },
                        ]}
                    >
                        <CurrencyInput
                            placeholder="Enter price"
                            showLabel={false}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="status"
                        label="Status"
                        initialValue="Available"
                    >
                        <Select placeholder="Select status">
                            {STATUS_OPTIONS.map((status) => (
                                <Option key={status} value={status}>
                                    {status}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item
                        name="description"
                        label="Description"
                        tooltip="A detailed description of the property. This is optional."
                    >
                        <TextArea
                            rows={4}
                            placeholder="Describe the property features, condition, and any notable details..."
                        />
                    </Form.Item>
                </Col>

                {/* Location Section - Required Fields */}
                <Col span={24}>
                    <Divider className="my-2">
                        <EnvironmentOutlined className="mr-2" />
                        Location
                    </Divider>
                </Col>

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
                                        <span className="text-gray-400 ml-2">
                                            ({project.location.name})
                                        </span>
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

                {/* City and Area - Optional fields */}
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
            </Row>
        </Card>
    );
}
