import React from "react";
import { Form, Select, Row, Col, Card, Typography, Divider } from "antd";
import { FormInstance } from "antd/lib/form";
import { Property, PropertyEnumValues } from "@/Types";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
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
                {td("Classify your property to help buyers find it more easily. These fields help generate a unique reference code.", { source: "en" })}
            </Text>

            <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="construction_status"
                        label={td("Construction Status", { source: "en" })}
                        tooltip={td("Current construction or completion status", { source: "en" })}
                    >
                        <Select
                            placeholder={td("Select construction status", { source: "en" })}
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
                        label={td("Occupancy Status", { source: "en" })}
                        tooltip={td("Whether the property is currently occupied", { source: "en" })}
                    >
                        <Select
                            placeholder={td("Select occupancy status", { source: "en" })}
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
                        label={td("View Types", { source: "en" })}
                        tooltip={td("Select all views that apply to this property", { source: "en" })}
                    >
                        <Select
                            mode="multiple"
                            placeholder={td("Select view types", { source: "en" })}
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
