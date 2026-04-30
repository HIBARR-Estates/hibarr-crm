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

export const FULL_SYSTEM_FACILITIES: Array<{ name: string; label: string }> = [
    { name: "gym", label: "Gym" },
    { name: "hamam", label: "Hamam" },
    { name: "sauna", label: "Sauna" },
    { name: "massage_spa", label: "Massage and Spa" },
    { name: "indoor_pool", label: "Indoor Pool" },
    { name: "outdoor_pool", label: "Outdoor Pool" },
    { name: "heated_indoor_pool", label: "Heated Indoor Pool" },
    { name: "kids_playground", label: "Kids Playground" },
    { name: "aquapark", label: "Aquapark" },
    { name: "mini_zoo", label: "Mini Zoo" },
    { name: "clinics", label: "Clinics" },
    { name: "restaurant", label: "Restaurant" },
    { name: "beauty_center", label: "Beauty Center" },
    { name: "walking_paths", label: "Walking Paths" },
    { name: "cycling_routes", label: "Cycling Routes" },
    { name: "hiking_routes", label: "Hiking Routes" },
    { name: "dentist", label: "Dentist" },
    { name: "healing_yoga", label: "Healing/Yoga" },
    { name: "tennis_court", label: "Tennis Court" },
    { name: "basketball_court", label: "Basketball Court" },
    { name: "reception", label: "Reception" },
    { name: "security_24_7", label: "24/7 Security" },
    { name: "beach", label: "Beach" },
    { name: "beach_cinema", label: "Beach Cinema" },
    { name: "cinema", label: "Cinema" },
    { name: "casino", label: "Casino" },
    { name: "jacuzzi", label: "Jacuzzi" },
    { name: "gated_community", label: "Gated Community" },
    { name: "football_court", label: "Football Court" },
    { name: "volleyball_court", label: "Volleyball Court" },
    { name: "supermarket", label: "Supermarket" },
    { name: "cafe", label: "Cafe" },
    { name: "bar", label: "Bar" },
    { name: "car_park", label: "Car Park" },
    { name: "cleaning_service", label: "Cleaning Service" },
    { name: "central_generator", label: "Central Generator" },
    { name: "on_site_management", label: "On-site Management" },
];

/**
 * Project facilities checkboxes — fetched from the property-config API.
 * Stored as a JSON array of selected facility slugs in developer_projects.facilities.
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

        for (const facility of FULL_SYSTEM_FACILITIES) {
            merged.set(facility.name, facility);
        }

        for (const facility of configuredFacilities) {
            merged.set(facility.name, facility);
        }

        for (const facility of fallbackFacilities) {
            merged.set(facility.name, facility);
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
