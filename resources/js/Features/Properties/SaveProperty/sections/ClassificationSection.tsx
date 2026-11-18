import React from "react";
import { Form, Select, DatePicker, Row, Col } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory, PropertyEnumValues } from "@/Types";
import { useFormOptions } from "../useFormOptions";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
    const { constructionStatusOptions, viewTypeOptions, occupancyTypeOptions } =
        useFormOptions(enumValues, primaryCategory);

    return (
        <Row gutter={[16, 0]}>
            {/* Construction Status */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="construction_status"
                    label={td("Construction Status", { source: "en" })}
                >
                    <Select placeholder={td("Select status", { source: "en" })} allowClear>
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
                <Form.Item name="completion_date" label={td("Completion Date", { source: "en" })}>
                    <DatePicker
                        style={{ width: "100%" }}
                        picker="month"
                        placeholder={td("Select month/year", { source: "en" })}
                        disabled={lockedFields.has('completion_date')}
                    />
                </Form.Item>
            </Col>

            {/* View Types — multi-select */}
            <Col span={24}>
                <Form.Item
                    name="view_types"
                    label={td("View Types", { source: "en" })}
                    tooltip={td("Select all applicable view types", { source: "en" })}
                >
                    <Select
                        mode="multiple"
                        placeholder={td("Select view types", { source: "en" })}
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
                        label={td("Current Occupancy", { source: "en" })}
                    >
                        <Select placeholder={td("Select", { source: "en" })} allowClear>
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
