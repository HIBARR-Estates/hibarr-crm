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
    return (
        <Row gutter={[16, 0]}>
            {/* Property-level Construction Status */}
            <Col xs={24} md={8}>
                <Form.Item
                    name="construction_status"
                    label="Construction Status"
                >
                    <Select
                        placeholder="Select status"
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
                <Form.Item name="completion_date" label="Completion Date">
                    <DatePicker
                        picker="month"
                        style={{ width: "100%" }}
                        placeholder="Select completion date"
                    />
                </Form.Item>
            </Col>

            {/* Number of Phases */}
            <Col xs={24} md={8}>
                <Form.Item name="number_of_phases" label="Number of Phases">
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
                <Form.Item name="primary_categories" label="Primary Category">
                    <Select
                        mode="multiple"
                        placeholder="Select categories"
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
                <Form.Item name="title_deed_type" label="Title Deed Type">
                    <Select
                        placeholder="Select deed type"
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
                <Form.Item name="unit_types" label="Unit Types">
                    <Select
                        mode="multiple"
                        placeholder="Select unit types"
                        allowClear
                        options={UNIT_TYPE_OPTIONS.map((o) => ({
                            value: o.value,
                            label: o.label,
                        }))}
                    />
                </Form.Item>
            </Col>

            {/* Number of Units */}
            <Col xs={24} md={6}>
                <Form.Item name="number_of_units" label="Number of Units">
                    <InputNumber
                        min={1}
                        max={10000}
                        placeholder="e.g. 200"
                        style={{ width: "100%" }}
                    />
                </Form.Item>
            </Col>

            {/* Number of Blocks (Apt) */}
            <Col xs={24} md={6}>
                <Form.Item name="number_of_blocks" label="Number of Blocks">
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
                    label="Project Total Area (m²)"
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
                <Form.Item name="furniture_package" label="Furniture Package">
                    <Select
                        placeholder="Select furniture option"
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
                <Form.Item name="rental_guarantee" label="Rental Guarantee">
                    <Select
                        placeholder="Select"
                        allowClear
                        options={[
                            { value: true, label: "Yes" },
                            { value: false, label: "No" },
                        ]}
                    />
                </Form.Item>
            </Col>
        </Row>
    );
};

export default ConstructionProjectDetailsSection;
