import React from "react";
import { Form, Select, InputNumber, DatePicker, Row, Col } from "antd";
import type { FormInstance } from "antd/lib/form";
import {
    PROJECT_CONSTRUCTION_STATUSES,
    PROPERTY_CONSTRUCTION_STATUSES,
    UNIT_TYPE_OPTIONS,
    TITLE_DEED_TYPE_OPTIONS,
    PROJECT_PRIMARY_CATEGORY_OPTIONS,
    FURNITURE_PACKAGES,
} from "../constructionProjectConfig";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface ConstructionProjectDetailsSectionProps {
    form: FormInstance;
}

/**
 * Construction project classification and specifications:
 * - Property-level construction status (Off-Plan, Under Construction, etc.)
 * - Completion date
 * - Primary categories (multi-select: Residential, Commercial)
 * - Title deed type
 * - Unit types (multi-select)
 * - Number of units, blocks, phases
 * - Project total area
 * - Project-level construction status (Pre-construction, Active, etc.)
 * - Furniture package
 * - Rental guarantee
 */
const ConstructionProjectDetailsSection: React.FC<
    ConstructionProjectDetailsSectionProps
> = ({ form }) => {
    const { td } = useTd();
    return (
        <Row gutter={[16, 0]}>
            {/* Property-level Construction Status */}
            <Col xs={24} md={8}>
                <Form.Item
                    name="construction_status"
                    label={td("Construction Status", { source: "en" })}
                >
                    <Select
                        placeholder={td("Select status", { source: "en" })}
                        allowClear
                        options={PROJECT_CONSTRUCTION_STATUSES.map((s) => ({
                            value: s.value,
                            label: s.label,
                        }))}
                    />
                </Form.Item>
            </Col>

            {/* Completion Date */}
            <Col xs={24} md={8}>
                <Form.Item name="completion_date" label={td("Completion Date", { source: "en" })}>
                    <DatePicker
                        picker="month"
                        style={{ width: "100%" }}
                        placeholder={td("Select completion date", { source: "en" })}
                    />
                </Form.Item>
            </Col>

            {/* Number of Phases */}
            <Col xs={24} md={8}>
                <Form.Item name="number_of_phases" label={td("Number of Phases", { source: "en" })}>
                    <InputNumber
                        min={1}
                        max={50}
                        placeholder="e.g. 3"
                        style={{ width: "100%" }}
                    />
                </Form.Item>
            </Col>

            {/* Primary Category (multi-select) */}
            <Col xs={24} md={12}>
                <Form.Item name="primary_categories" label={td("Primary Category", { source: "en" })}>
                    <Select
                        mode="multiple"
                        placeholder={td("Select categories", { source: "en" })}
                        allowClear
                        options={PROJECT_PRIMARY_CATEGORY_OPTIONS.map((o) => ({
                            value: o.value,
                            label: o.label,
                        }))}
                    />
                </Form.Item>
            </Col>

            {/* Title Deed Type */}
            <Col xs={24} md={12}>
                <Form.Item name="title_deed_type" label={td("Title Deed Type", { source: "en" })}>
                    <Select
                        placeholder={td("Select deed type", { source: "en" })}
                        allowClear
                        options={TITLE_DEED_TYPE_OPTIONS.map((o) => ({
                            value: o.value,
                            label: o.label,
                        }))}
                    />
                </Form.Item>
            </Col>

            {/* Unit Types (multi-select) */}
            <Col xs={24} md={12}>
                <Form.Item name="unit_types" label={td("Unit Types", { source: "en" })}>
                    <Select
                        mode="multiple"
                        placeholder={td("Select unit types", { source: "en" })}
                        allowClear
                        options={UNIT_TYPE_OPTIONS.map((o) => ({
                            value: o.value,
                            label: o.label,
                        }))}
                    />
                </Form.Item>
            </Col>

            {/* Number of Units */}
            {/* <Col xs={24} md={6}>
                <Form.Item name="number_of_units" label="Number of Units">
                    <InputNumber
                        min={1}
                        max={10000}
                        placeholder="e.g. 200"
                        style={{ width: "100%" }}
                    />
                </Form.Item>
            </Col> */}

            {/* Number of Blocks (Apt) */}
            <Col xs={24} md={6}>
                <Form.Item name="number_of_blocks" label={td("Number of Blocks", { source: "en" })}>
                    <InputNumber
                        min={1}
                        max={100}
                        placeholder="e.g. 5"
                        style={{ width: "100%" }}
                    />
                </Form.Item>
            </Col>

            {/* Project Total Area m² */}
            <Col xs={24} md={8}>
                <Form.Item
                    name="project_total_area_sqm"
                    label={td("Project Total Area (m²)", { source: "en" })}
                >
                    <InputNumber<number>
                        min={0}
                        max={9999999}
                        placeholder="e.g. 50000"
                        style={{ width: "100%" }}
                        formatter={(value) =>
                            value
                                ? `${value}`.replace(
                                      /\B(?=(\d{3})+(?!\d))/g,
                                      ",",
                                  )
                                : ""
                        }
                        parser={(value) =>
                            value ? Number(value.replace(/,/g, "")) : 0
                        }
                    />
                </Form.Item>
            </Col>

            {/* Furniture Package */}
            <Col xs={24} md={8}>
                <Form.Item name="furniture_package" label={td("Furniture Package", { source: "en" })}>
                    <Select
                        placeholder={td("Select furniture option", { source: "en" })}
                        allowClear
                        options={FURNITURE_PACKAGES.map((o) => ({
                            value: o.value,
                            label: o.label,
                        }))}
                    />
                </Form.Item>
            </Col>

            {/* Rental Guarantee */}
            <Col xs={24} md={8}>
                <Form.Item name="rental_guarantee" label={td("Rental Guarantee", { source: "en" })}>
                    <Select
                        placeholder={td("Select", { source: "en" })}
                        allowClear
                        options={[
                            { value: true, label: td("Yes", { source: "en" }) },
                            { value: false, label: td("No", { source: "en" }) },
                        ]}
                    />
                </Form.Item>
            </Col>
        </Row>
    );
};

export default ConstructionProjectDetailsSection;
