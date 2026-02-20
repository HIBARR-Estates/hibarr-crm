import React from "react";
import { Card, Row, Col, Typography } from "antd";
import {
    HomeOutlined,
    ColumnHeightOutlined,
    CalendarOutlined,
    ExpandOutlined,
} from "@ant-design/icons";
import { Property, PrimaryCategory } from "@/Types";
import {
    SPECIFICATION_FIELDS,
    SpecificationFields,
} from "@/Features/Properties/SaveProperty/fieldConfig";

const { Text } = Typography;

interface SpecificationsCardProps {
    property: Property;
}

interface StatBlock {
    label: string;
    value: string | number;
    icon: React.ReactNode;
}

export default function SpecificationsCard({
    property,
}: SpecificationsCardProps) {
    const category =
        (property.primary_category as PrimaryCategory) || "residential";
    const fields: SpecificationFields = SPECIFICATION_FIELDS[category];

    const stats: StatBlock[] = [];

    if (
        fields.bedrooms &&
        property.bedrooms !== undefined &&
        property.bedrooms !== null
    ) {
        stats.push({
            label: "Bedrooms",
            value: property.bedrooms === 0 ? "Studio" : property.bedrooms,
            icon: <HomeOutlined />,
        });
    }

    if (fields.bathrooms && property.bathrooms) {
        stats.push({
            label: "Bathrooms",
            value: property.bathrooms,
            icon: <HomeOutlined />,
        });
    }

    if (fields.livingRoom && property.living_room) {
        stats.push({
            label: "Living Rooms",
            value: property.living_room,
            icon: <HomeOutlined />,
        });
    }

    if (fields.plotSize && property.land_size) {
        stats.push({
            label: "Plot Size",
            value: `${property.land_size.toLocaleString()} m²`,
            icon: <ExpandOutlined />,
        });
        if (property.land_size_donum) {
            stats.push({
                label: "Plot (Dönüm)",
                value: `${property.land_size_donum} dönüm`,
                icon: <ExpandOutlined />,
            });
        }
    }

    if (fields.grossArea && property.living_area_sqm) {
        stats.push({
            label: "Gross Area",
            value: `${property.living_area_sqm} m²`,
            icon: <ExpandOutlined />,
        });
    }

    if (fields.balconyArea && property.terrace_area_sqm) {
        stats.push({
            label: "Balcony / Terrace",
            value: `${property.terrace_area_sqm} m²`,
            icon: <ExpandOutlined />,
        });
    }

    if (
        fields.floorNumber &&
        property.floor_number !== undefined &&
        property.floor_number !== null
    ) {
        stats.push({
            label: "Floor",
            value:
                property.floor_number === 0
                    ? "Ground"
                    : property.floor_number === -1
                      ? "Basement"
                      : property.floor_number,
            icon: <ColumnHeightOutlined />,
        });
    }

    if (fields.floorsInBuilding && property.floors_in_building) {
        stats.push({
            label: "Floors in Building",
            value: property.floors_in_building,
            icon: <ColumnHeightOutlined />,
        });
    }

    if (
        fields.buildingAge &&
        property.building_age !== undefined &&
        property.building_age !== null
    ) {
        stats.push({
            label: "Building Age",
            value: `${property.building_age} yrs`,
            icon: <CalendarOutlined />,
        });
    }

    if (fields.furnitureStatus && property.furniture_status) {
        stats.push({
            label: "Furnishing",
            value: property?.furniture_status?.split("_").join(" "),
            icon: <HomeOutlined />,
        });
    }

    if (property.within_site) {
        stats.push({
            label: "Within Site",
            value: "Yes",
            icon: <HomeOutlined />,
        });
    }

    if (stats.length === 0) return null;

    return (
        <Card
            title={
                <span>
                    <ExpandOutlined className="mr-2" />
                    {category === "land" ? "Land Area" : "Specifications"}
                </span>
            }
            variant="outlined"
            size="small"
        >
            <Row gutter={[12, 12]}>
                {stats.map((stat, i) => (
                    <Col key={i} xs={12} sm={8} md={6}>
                        <div className="text-center py-3 px-2 bg-gray-50 rounded-lg">
                            <div className="text-gray-400 text-lg mb-1">
                                {stat.icon}
                            </div>
                            <div className="text-base font-semibold text-gray-800">
                                {stat.value}
                            </div>
                            <Text type="secondary" className="text-xs">
                                {stat.label}
                            </Text>
                        </div>
                    </Col>
                ))}
            </Row>
        </Card>
    );
}
