import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
    Form,
    Input,
    Select,
    Row,
    Col,
    Card,
    InputNumber,
    Divider,
} from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues, PrimaryCategory } from "@/Types";
import { usePage } from "@inertiajs/react";
import CurrencyInput from "@/Components/CurrencyInput";
import { formatLocationNameForDisplay } from "@/lib/utils";

const { Option } = Select;
const { TextArea } = Input;

// Property types organized by primary category
const PROPERTY_TYPES_BY_CATEGORY: Record<
    PrimaryCategory,
    { label: string; types: string[] }[]
> = {
    'construction_project': [],
    residential: [
        {
            label: "Housing",
            types: [
                "Apartment",
                "Villa",
                "Semi-Detached Villa",
                "Bungalow",
                "Townhouse",
                "Complete Building",
                "Ruin",
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
            "Apartment",
            "Villa",
            "Semi-Detached Villa",
            "Bungalow",
            "Townhouse",
            "Complete Building",
            "Ruin",
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
    developer_id?: number | null;
    location?: { id: number; name: string } | null;
    project_location_id?: number;
}

interface DeveloperOption {
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
    const developers = (props?.developers || []) as DeveloperOption[];
    const unitStyles = enumValues?.unit_styles || [];
    const primaryCategories = enumValues?.primary_categories || [];

    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
        data?.developer_project_id ?? null,
    );
    const [selectedDeveloperId, setSelectedDeveloperId] = useState<
        number | null
    >(() => {
        // Try to derive developer from existing project
        if (data?.developer_project_id) {
            const project = (
                (props?.developerProjects as DeveloperProject[]) || []
            ).find((p) => p.id === data.developer_project_id);
            return project?.developer_id ?? null;
        }
        return null;
    });
    const [selectedCategory, setSelectedCategory] =
        useState<PrimaryCategory | null>(
            (data?.primary_category as PrimaryCategory) ?? null,
        );
    const [selectedUnitStyle, setSelectedUnitStyle] = useState<string[] | null>(
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
    const isResidential = selectedCategory === "residential";
    const isStudio =
        Array.isArray(selectedUnitStyle) &&
        selectedUnitStyle.includes("studio");
    const showUnitStyle = isResidential;
    const showRoomFields = !isLand && !isStudio;
    const withinSite = Form.useWatch("within_site", form);

    // Filter projects by selected developer
    const filteredProjects = useMemo(() => {
        if (!selectedDeveloperId) return developerProjects;
        return developerProjects.filter(
            (p) => p.developer_id === selectedDeveloperId,
        );
    }, [selectedDeveloperId, developerProjects]);

    // Filtered property types based on selected category
    const propertyTypeOptions = useMemo(() => {
        if (selectedCategory && PROPERTY_TYPES_BY_CATEGORY[selectedCategory]) {
            // Flat list when a category is selected
            return PROPERTY_TYPES_BY_CATEGORY[selectedCategory].flatMap(
                (g) => g.types,
            );
        }
        return null; // null = show grouped fallback
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
        // Clear unit style for non-residential categories
        if (value && value !== "residential") {
            form.setFieldValue("unit_style", undefined);
            setSelectedUnitStyle(null);
        }
    };

    const handleUnitStyleChange = (value: string[]) => {
        setSelectedUnitStyle(value?.length ? value : null);
        // Clear room fields when studio is selected
        if (value?.includes("studio")) {
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

    const handleProjectChange = (value: number | undefined) => {
        setSelectedProjectId(value ?? null);
    };

    const handleWithinSiteChange = useCallback(
        (value: boolean | undefined) => {
            if (!value) {
                setSelectedDeveloperId(null);
                setSelectedProjectId(null);
                form.setFieldValue("_selected_developer_id", undefined);
                form.setFieldValue("developer_project_id", undefined);
            }
        },
        [form],
    );

    const handleDeveloperChange = useCallback(
        (value: number | undefined) => {
            setSelectedDeveloperId(value ?? null);
            setSelectedProjectId(null);
            form.setFieldValue("developer_project_id", undefined);
        },
        [form],
    );

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
                                <Option
                                    key={category.name}
                                    value={category.name}
                                >
                                    {category.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                {/* Residence / Project flow — not applicable for land */}
                {!isLand && (
                    <>
                        <Col span={24}>
                            <Divider
                                plain
                                className="!my-2 !text-xs !text-gray-400"
                            >
                                Residence / Project
                            </Divider>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                name="within_site"
                                label="Is this property in a residence or project?"
                            >
                                <Select
                                    placeholder="Select"
                                    allowClear
                                    onChange={handleWithinSiteChange}
                                >
                                    <Option value={true}>Yes</Option>
                                    <Option value={false}>No</Option>
                                </Select>
                            </Form.Item>
                        </Col>

                        {withinSite === true && (
                            <>
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="_selected_developer_id"
                                        label="Construction Company"
                                        tooltip="Select the construction company / developer"
                                    >
                                        <Select
                                            placeholder="Select construction company"
                                            allowClear
                                            showSearch
                                            optionFilterProp="children"
                                            onChange={handleDeveloperChange}
                                        >
                                            {developers.map((dev) => (
                                                <Option
                                                    key={dev.id}
                                                    value={dev.id}
                                                >
                                                    {dev.name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="developer_project_id"
                                        label="Project Name"
                                        tooltip="Select the project / residence name"
                                    >
                                        <Select
                                            placeholder={
                                                selectedDeveloperId
                                                    ? "Select project"
                                                    : "Select a company first, or pick from all projects"
                                            }
                                            allowClear
                                            showSearch
                                            optionFilterProp="children"
                                            onChange={handleProjectChange}
                                        >
                                            {filteredProjects.map((project) => (
                                                <Option
                                                    key={project.id}
                                                    value={project.id}
                                                >
                                                    {project.name}
                                                    {project.location && (
                                                        <span className="text-gray-400 ml-2">
                                                            (
                                                            {
                                                                formatLocationNameForDisplay(
                                                                    project
                                                                        .location
                                                                        .name,
                                                                )
                                                            }
                                                            )
                                                        </span>
                                                    )}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </>
                        )}
                    </>
                )}

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
                            {propertyTypeOptions
                                ? propertyTypeOptions.map((type) => (
                                      <Option key={type} value={type}>
                                          {type}
                                      </Option>
                                  ))
                                : Object.values(ALL_PROPERTY_CATEGORIES).map(
                                      (category) => (
                                          <Select.OptGroup
                                              key={category.label}
                                              label={category.label}
                                          >
                                              {category.types.map((type) => (
                                                  <Option
                                                      key={type}
                                                      value={type}
                                                  >
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
                            {saleTypes.map((type) => (
                                <Option key={type} value={type}>
                                    {type}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                {/* Unit Style - only for residential, multi-select */}
                {showUnitStyle && (
                    <Col xs={24} md={12}>
                        <Form.Item
                            name="unit_style"
                            label="Unit Style"
                            tooltip="Used in reference code (e.g., APT-LFT-11-402 for Loft)"
                        >
                            <Select
                                mode="multiple"
                                placeholder="Select unit style(s)"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                onChange={handleUnitStyleChange}
                            >
                                {unitStyles.map((style) => (
                                    <Option key={style.name} value={style.name}>
                                        {style.label}
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
                            <Form.Item name="bathrooms" label="Bathrooms">
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
                    <Form.Item name="price" label="Price">
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
            </Row>
        </Card>
    );
}
