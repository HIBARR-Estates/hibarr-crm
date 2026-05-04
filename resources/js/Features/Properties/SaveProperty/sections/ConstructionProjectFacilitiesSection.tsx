import React, { useMemo } from "react";
import { Form, Checkbox, Row, Col, Typography, Spin, Alert } from "antd";
import type { FormInstance } from "antd/lib/form";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { ConfigItemsResponse } from "@/Types/propertyConfig";

const { Text } = Typography;

interface ConstructionProjectFacilitiesSectionProps {
    form: FormInstance;
    open?: boolean;
    projectFacilities?: string[] | null;
}

/**
 * Project facilities checkboxes — options come only from property-config (`project-facilities`).
 * If the form already has saved slugs missing from config, those are appended so selections stay visible.
 * Stored as a JSON array of facility slugs in developer_projects.facilities.
 */
const ConstructionProjectFacilitiesSection: React.FC<
    ConstructionProjectFacilitiesSectionProps
> = ({ form, open = true, projectFacilities = null }) => {
    const facilitiesQuery = useApiQuery<ConfigItemsResponse>({
        path: route("property-config.index", { type: "project-facilities" }),
        options: {
            enabled: open,
        },
    });

    const configuredFacilities = facilitiesQuery.data?.data ?? [];
    const selectedFacilities = Form.useWatch("facilities", form) as
        | string[]
        | undefined;

    const fallbackFacilities = useMemo(() => {
        const source = selectedFacilities ?? projectFacilities ?? [];
        return source.map((name) => ({
            id: name,
            name,
            label: name
                .replace(/_/g, " ")
                .replace(/\b\w/g, (char) => char.toUpperCase()),
        }));
    }, [projectFacilities, selectedFacilities]);

    const facilities = useMemo(() => {
        const merged = new Map<string, { name: string; label: string }>();

        for (const facility of configuredFacilities) {
            merged.set(facility.name, {
                name: facility.name,
                label: facility.label,
            });
        }

        for (const facility of fallbackFacilities) {
            if (!merged.has(facility.name)) {
                merged.set(facility.name, facility);
            }
        }

        return Array.from(merged.values());
    }, [configuredFacilities, fallbackFacilities]);

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
                <>
                    {facilitiesQuery.isError && (
                        <Alert
                            type="warning"
                            showIcon
                            className="mb-3"
                            message="Could not load facilities list from config. Showing saved facilities instead."
                        />
                    )}
                    <Form.Item name="facilities" noStyle>
                        <Checkbox.Group style={{ width: "100%" }}>
                            <Row gutter={[8, 4]}>
                                {facilities.map((facility) => (
                                    <Col
                                        key={facility.name}
                                        xs={12}
                                        sm={8}
                                        md={6}
                                    >
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
                </>
            )}
        </div>
    );
};

export default ConstructionProjectFacilitiesSection;
