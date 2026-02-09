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
    InputNumber,
} from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues, PrimaryCategory } from "@/Types";
import { usePage } from "@inertiajs/react";
import CurrencyInput from "@/Components/CurrencyInput";
import { EnvironmentOutlined } from "@ant-design/icons";

const { Option } = Select;
const { TextArea } = Input;

// Property types organized by primary category
const PROPERTY_TYPES_BY_CATEGORY: Record<
    PrimaryCategory,
    { label: string; types: string[] }[]
> = {
    residential: [
        {
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
                "Block of apartments",
                "Complete Building",
                "Abandoned Building",
                "Residence",
                "Half Construction",
                "Time Share",
            ],
        },
    ],
    commercial: [
        {
            label: "Commercial Real Estate",
            types: [
                "Shop",
                "Hotel",
                "Workplace",
                "Warehouse",
                "Workplace for sale",
                "Office",
                "Commercial Property",
            ],
        },
    ],
    land: [
        {
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
    ],
};

// All property types (fallback when no category selected)
const ALL_PROPERTY_CATEGORIES = {
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

const ALL_SALE_TYPES = ["For Sale", "For Rent", "For Daily Rental"];
const SALE_ONLY_TYPES = ["For Sale"];

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
    const unitStyles = enumValues?.unit_styles || [];
    const primaryCategories = enumValues?.primary_categories || [];

    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
        data?.developer_project_id ?? null,
    );
    const [selectedCategory, setSelectedCategory] =
        useState<PrimaryCategory | null>(
            (data?.primary_category as PrimaryCategory) ?? null,
        );
    const [selectedUnitStyle, setSelectedUnitStyle] = useState<string | null>(
        data?.unit_style ?? null,
    );

    // Sync state from form values on mount / data change
    useEffect(() => {
        const projectId = form.getFieldValue("developer_project_id");
        setSelectedProjectId(projectId ?? null);
        const category = form.getFieldValue("primary_category");
        setSelectedCategory(category ?? null);
        const unitStyle = form.getFieldValue("unit_style");
        setSelectedUnitStyle(unitStyle ?? null);
    }, [form]);

    // Derived flags
    const isLand = selectedCategory === "land";
    const isStudio = selectedUnitStyle === "studio";
    const showRoomFields = !isLand && !isStudio;

    // Filtered property types based on selected category
    const propertyTypeGroups = useMemo(() => {
        if (selectedCategory && PROPERTY_TYPES_BY_CATEGORY[selectedCategory]) {
            return PROPERTY_TYPES_BY_CATEGORY[selectedCategory];
        }
        // Fallback: show all grouped
        return Object.values(ALL_PROPERTY_CATEGORIES);
    }, [selectedCategory]);

    // Filtered sale types
    const saleTypes = useMemo(() => {
        if (isLand) return SALE_ONLY_TYPES;
        return ALL_SALE_TYPES;
    }, [isLand]);

    const handleCategoryChange = (value: PrimaryCategory | undefined) => {
        setSelectedCategory(value ?? null);
        // Reset dependent fields when category changes
        const currentPropertyType = form.getFieldValue("property_type");
        if (currentPropertyType) {
            // Check if current type is still valid for new category
            const validTypes =
                value && PROPERTY_TYPES_BY_CATEGORY[value]
                    ? PROPERTY_TYPES_BY_CATEGORY[value].flatMap((g) => g.types)
                    : Object.values(ALL_PROPERTY_CATEGORIES).flatMap(
                          (g) => g.types,
                      );
            if (!validTypes.includes(currentPropertyType)) {
                form.setFieldValue("property_type", undefined);
            }
        }
        // Reset sale_type if switching to land and current is a rent type
        if (value === "land") {
            const currentSaleType = form.getFieldValue("sale_type");
            if (currentSaleType && !SALE_ONLY_TYPES.includes(currentSaleType)) {
                form.setFieldValue("sale_type", undefined);
            }
            // Clear fields not applicable to land
            form.setFieldValue("unit_style", undefined);
            form.setFieldValue("bedrooms", undefined);
            form.setFieldValue("living_room", undefined);
            setSelectedUnitStyle(null);
        }
    };

    const handleUnitStyleChange = (value: string | undefined) => {
        setSelectedUnitStyle(value ?? null);
        // Clear room fields when studio is selected
        if (value === "studio") {
            form.setFieldValue("bedrooms", undefined);
            form.setFieldValue("living_room", undefined);
        }
    };

    const formatLabel = (value: string) => {
        return value
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    };

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
                {/* Primary Category - First Field */}
                <Col span={24}>
                    <Form.Item
                        name="primary_category"
                        label="Primary Category"
                        tooltip="The main category determines available property types, sale types, and fields"
                        rules={[
                            {
                                required: true,
                                message: "Please select a primary category",
                            },
                        ]}
                    >
                        <Select
                            placeholder="Select primary category"
                            allowClear
                            onChange={handleCategoryChange}
                        >
                            {primaryCategories.map((category) => (
                                <Option key={category} value={category}>
                                    {formatLabel(category)}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

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
                            {propertyTypeGroups.map((category) => (
                                <Select.OptGroup
                                    key={category.label}
                                    label={category.label}
                                >
                                    {category.types.map((type) => (
                                        <Option key={type} value={type}>
                                            {type}
                                        </Option>
                                    ))}
                                </Select.OptGroup>
                            ))}
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
                            {saleTypes.map((type) => (
                                <Option key={type} value={type}>
                                    {type}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                {/* Unit Style - hidden for land */}
                {!isLand && (
                    <Col xs={24} md={12}>
                        <Form.Item
                            name="unit_style"
                            label="Unit Style"
                            tooltip="Used in reference code (e.g., APT-LFT-11-402 for Loft)"
                        >
                            <Select
                                placeholder="Select unit style"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                onChange={handleUnitStyleChange}
                            >
                                {unitStyles.map((style) => (
                                    <Option key={style} value={style}>
                                        {style
                                            .split("_")
                                            .map(
                                                (word: string) =>
                                                    word
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                    word.slice(1),
                                            )
                                            .join(" ")}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                )}

                {/* Room counts - hidden for land and studio */}
                {showRoomFields && (
                    <>
                        <Col xs={12} md={6}>
                            <Form.Item
                                name="bedrooms"
                                label="Bedrooms"
                                tooltip="Used in reference code (e.g., 3+1 = 31)"
                            >
                                <InputNumber
                                    placeholder="0-8"
                                    min={0}
                                    max={8}
                                    style={{ width: "100%" }}
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Item
                                name="living_room"
                                label="Living Rooms"
                                tooltip="Used in reference code (e.g., 3+1 = 31)"
                                initialValue={1}
                            >
                                <InputNumber
                                    placeholder="1"
                                    min={0}
                                    max={5}
                                    style={{ width: "100%" }}
                                />
                            </Form.Item>
                        </Col>
                    </>
                )}

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
