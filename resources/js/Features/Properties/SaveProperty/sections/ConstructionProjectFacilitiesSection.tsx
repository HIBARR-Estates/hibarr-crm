import React from "react";
import { Form, Checkbox, Row, Col, Typography, Spin } from "antd";
import type { FormInstance } from "antd/lib/form";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { ConfigItemsResponse } from "@/Types/propertyConfig";

const { Text } = Typography;

interface ConstructionProjectFacilitiesSectionProps {
    form: FormInstance;
}

/**
 * Project facilities checkboxes — fetched from the property-config API.
 * Stored as a JSON array of selected facility slugs in developer_projects.facilities.
 */
const ConstructionProjectFacilitiesSection: React.FC<
    ConstructionProjectFacilitiesSectionProps
> = ({ form }) => {
    const facilitiesQuery = useApiQuery<ConfigItemsResponse>({
        path: route("property-config.index", { type: "project-facilities" }),
    });

    const facilities = facilitiesQuery.data?.data ?? [];

    return (
        <div>
            <Text type="secondary" className="block text-xs mb-3">
                Select all facilities available in this project
            </Text>
            {facilitiesQuery.isLoading ? (
                <div className="flex justify-center py-4">
                    <Spin size="small" />
                </div>
            ) : (
                <Form.Item name="facilities" noStyle>
                    <Checkbox.Group style={{ width: "100%" }}>
                        <Row gutter={[8, 4]}>
                            {facilities.map((facility) => (
                                <Col key={facility.name} xs={12} sm={8} md={6}>
                                    <Checkbox
                                        value={facility.name}
                                        className="text-sm"
                                    >
                                        {facility.label}
                                    </Checkbox>
                                </Col>
                            ))}
                        </Row>
                    </Checkbox.Group>
                </Form.Item>
            )}
        </div>
    );
};

export default ConstructionProjectFacilitiesSection;
