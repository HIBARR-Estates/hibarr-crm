import React from "react";
import { Form, Select, DatePicker, Row, Col } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory, PropertyEnumValues } from "@/Types";
import { useFormOptions } from "../useFormOptions";

const { Option } = Select;

interface ClassificationSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    enumValues?: PropertyEnumValues;
    lockedFields?: Set<string>;
}

const ClassificationSection: React.FC<ClassificationSectionProps> = ({
    form,
    primaryCategory,
    enumValues,
    lockedFields = new Set<string>(),
}) => {
    const { constructionStatusOptions, viewTypeOptions, occupancyTypeOptions } =
        useFormOptions(enumValues, primaryCategory);

    return (
        <Row gutter={[16, 0]}>
            {/* Construction Status */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="construction_status"
                    label="Construction Status"
                >
                    <Select placeholder="Select status" allowClear>
                        {constructionStatusOptions.map((o) => (
                            <Option key={o.value} value={o.value}>
                                {o.label}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
            </Col>

            {/* Completion Date */}
            <Col xs={24} md={12}>
                <Form.Item name="completion_date" label="Completion Date">
                    <DatePicker
                        style={{ width: "100%" }}
                        picker="month"
                        placeholder="Select month/year"
                        disabled={lockedFields.has('completion_date')}
                    />
                </Form.Item>
            </Col>

            {/* View Types — multi-select */}
            <Col span={24}>
                <Form.Item
                    name="view_types"
                    label="View Types"
                    tooltip="Select all applicable view types"
                >
                    <Select
                        mode="multiple"
                        placeholder="Select view types"
                        allowClear
                        disabled={lockedFields.has('view_types')}
                    >
                        {viewTypeOptions.map((o) => (
                            <Option key={o.value} value={o.value}>
                                {o.label}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
            </Col>

            {/* Occupancy Type — not shown for land */}
            {primaryCategory !== "land" && (
                <Col xs={24} md={12}>
                    <Form.Item
                        name="current_occupancy"
                        label="Current Occupancy"
                    >
                        <Select placeholder="Select" allowClear>
                            {occupancyTypeOptions.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            )}
        </Row>
    );
};

export default ClassificationSection;
