import React from "react";
import { Form, Select, Row, Col, Card, Typography, Divider } from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues } from "@/Types";

const { Option } = Select;
const { Text } = Typography;

interface ClassificationStepProps {
    form: FormInstance;
    enumValues?: PropertyEnumValues;
    data?: Partial<Property>;
}

export default function ClassificationStep({
    form,
    enumValues,
    data,
}: ClassificationStepProps) {
    const constructionStatuses = enumValues?.construction_statuses || [];
    const viewTypes = enumValues?.view_types || [];
    const occupancyTypes = enumValues?.occupancy_types || [];

    const formatLabel = (value: string) => {
        return value
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    };

    return (
        <Card size="small" className="border-0 shadow-none">
            <Text type="secondary" className="block mb-4">
                Classify your property to help buyers find it more easily. These
                fields help generate a unique reference code.
            </Text>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="construction_status"
                        label="Construction Status"
                        tooltip="Current construction or completion status"
                    >
                        <Select
                            placeholder="Select construction status"
                            allowClear
                        >
                            {constructionStatuses.map((status) => (
                                <Option key={status.name} value={status.name}>
                                    {status.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                    <Form.Item
                        name="occupancy_type"
                        label="Occupancy Status"
                        tooltip="Whether the property is currently occupied"
                    >
                        <Select
                            placeholder="Select occupancy status"
                            allowClear
                        >
                            {occupancyTypes.map((type) => (
                                <Option key={type.name} value={type.name}>
                                    {type.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Divider className="my-4" />
                </Col>

                <Col span={24}>
                    <Form.Item
                        name="view_types"
                        label="View Types"
                        tooltip="Select all views that apply to this property"
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select view types"
                            allowClear
                            maxTagCount={4}
                            maxTagPlaceholder={(omitted) =>
                                `+${omitted.length} more`
                            }
                        >
                            {viewTypes.map((view) => (
                                <Option key={view.name} value={view.name}>
                                    {view.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            </Row>
        </Card>
    );
}
