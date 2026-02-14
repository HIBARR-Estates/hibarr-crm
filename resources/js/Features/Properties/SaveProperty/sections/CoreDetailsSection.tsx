import React from "react";
import { Form, Select, Row, Col } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory, PropertyEnumValues } from "@/Types";
import { usePage } from "@inertiajs/react";
import { SPECIFICATION_FIELDS } from "../fieldConfig";
import { useFormOptions } from "../useFormOptions";

const { Option } = Select;

interface CoreDetailsSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    enumValues?: PropertyEnumValues;
}

interface DeveloperProject {
    id: number;
    name: string;
    location?: { id: number; name: string } | null;
}

const CoreDetailsSection: React.FC<CoreDetailsSectionProps> = ({
    form,
    primaryCategory,
    enumValues,
}) => {
    const { props } = usePage<any>();
    const developerProjects = (props?.developerProjects ||
        []) as DeveloperProject[];

    const {
        propertyTypeOptions,
        saleTypeOptions,
        statusOptions,
        unitStyleOptions,
    } = useFormOptions(enumValues, primaryCategory);
    const specFields = SPECIFICATION_FIELDS[primaryCategory];

    // Unit style change handler (multi-select)
    const handleUnitStyleChange = (value: string[]) => {
        if (value?.includes("studio")) {
            form.setFieldValue("bedrooms", 0);
            form.setFieldValue("living_room", undefined);
        }
    };

    return (
        <Row gutter={[16, 0]}>
            {/* Property Type */}
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
                        {propertyTypeOptions.map((o) => (
                            <Option key={o.value} value={o.value}>
                                {o.label}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
            </Col>

            {/* Status */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="status"
                    label="Property Status"
                    rules={[
                        { required: true, message: "Please select status" },
                    ]}
                >
                    <Select placeholder="Select status">
                        {statusOptions.map((o) => (
                            <Option key={o.value} value={o.value}>
                                {o.label}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
            </Col>

            {/* Sale Type */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="sale_type"
                    label="Sale Type"
                    rules={[
                        { required: true, message: "Please select sale type" },
                    ]}
                >
                    <Select placeholder="Select sale type">
                        {saleTypeOptions.map((o) => (
                            <Option key={o.value} value={o.value}>
                                {o.label}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
            </Col>

            {/* Unit Style — residential only, multi-select */}
            {specFields.unitStyle && (
                <Col xs={24} md={12}>
                    <Form.Item name="unit_style" label="Unit Style">
                        <Select
                            mode="multiple"
                            placeholder="Select unit style(s)"
                            allowClear
                            onChange={handleUnitStyleChange}
                        >
                            {unitStyleOptions.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}

            {/* Developer Project — not applicable for land */}
            {primaryCategory !== "land" && (
                <Col xs={24} md={12}>
                    <Form.Item
                        name="developer_project_id"
                        label="Developer Project"
                        tooltip="Link this property to a developer project"
                    >
                        <Select
                            placeholder="Select developer project (optional)"
                            allowClear
                            showSearch
                            optionFilterProp="children"
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
            )}
        </Row>
    );
};

export default CoreDetailsSection;
