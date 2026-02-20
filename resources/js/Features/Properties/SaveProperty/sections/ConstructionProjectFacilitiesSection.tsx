import React from "react";
import { Form, Checkbox, Row, Col, Typography } from "antd";
import type { FormInstance } from "antd/lib/form";
import { PROJECT_FACILITIES } from "../constructionProjectConfig";

const { Text } = Typography;

interface ConstructionProjectFacilitiesSectionProps {
    form: FormInstance;
}

/**
 * Project facilities checkboxes — 34 items in a multi-column grid.
 * Stored as a JSON array of selected facility slugs in developer_projects.facilities.
 */
const ConstructionProjectFacilitiesSection: React.FC<
    ConstructionProjectFacilitiesSectionProps
> = ({ form }) => {
    return (
        <div>
            <Text type="secondary" className="block text-xs mb-3">
                Select all facilities available in this project
            </Text>
            <Form.Item name="facilities" noStyle>
                <Checkbox.Group style={{ width: "100%" }}>
                    <Row gutter={[8, 4]}>
                        {PROJECT_FACILITIES.map((facility) => (
                            <Col key={facility.value} xs={12} sm={8} md={6}>
                                <Checkbox
                                    value={facility.value}
                                    className="text-sm"
                                >
                                    {facility.label}
                                </Checkbox>
                            </Col>
                        ))}
                    </Row>
                </Checkbox.Group>
            </Form.Item>
        </div>
    );
};

export default ConstructionProjectFacilitiesSection;
