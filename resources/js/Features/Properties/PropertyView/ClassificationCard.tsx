import React from "react";
import { Card, Descriptions, Tag, Tooltip } from "antd";
import {
    ToolOutlined,
    EyeOutlined,
    TeamOutlined,
    CalendarOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";
import { formatCompanyDate } from "@/lib/companyDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface ClassificationCardProps {
    property: Property;
}

export default function ClassificationCard({
    property,
}: ClassificationCardProps) {
    const { td } = useTd();
    const hasData =
        property.construction_status ||
        (property.view_types && property.view_types.length > 0) ||
        property.current_occupancy ||
        property.completion_date;

    if (!hasData) return null;

    return (
        <Card
            title={
                <span>
                    <ToolOutlined className="mr-2" />
                    Classification
                </span>
            }
            variant="outlined"
            size="small"
        >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                {property.construction_status && (
                    <Descriptions.Item label={td("Construction Status", { source: "en" })}>
                        <Tag
                            color={
                                property.construction_status ===
                                    "completed_new" ||
                                property.construction_status === "resale"
                                    ? "green"
                                    : property.construction_status ===
                                        "under_construction"
                                      ? "orange"
                                      : property.construction_status ===
                                          "off_plan"
                                        ? "blue"
                                        : "default"
                            }
                        >
                            {property.construction_status.replace(/_/g, " ")}
                        </Tag>
                    </Descriptions.Item>
                )}

                {property.view_types && property.view_types.length > 0 && (
                    <Descriptions.Item label={td("Views", { source: "en" })}>
                        <div className="flex flex-wrap gap-1">
                            {property.view_types.map((v) => (
                                <Tag key={v} color="cyan" className="text-xs">
                                    {v.replace(/_/g, " ")}
                                </Tag>
                            ))}
                        </div>
                    </Descriptions.Item>
                )}

                {property.current_occupancy && (
                    <Descriptions.Item label={td("Occupancy", { source: "en" })}>
                        <Tag
                            color={
                                property.current_occupancy === "vacant"
                                    ? "green"
                                    : "orange"
                            }
                        >
                            {property.current_occupancy.replace(/_/g, " ")}
                        </Tag>
                    </Descriptions.Item>
                )}

                {property.completion_date && (
                    <Descriptions.Item label={td("Completion Date", { source: "en" })}>
                        <CalendarOutlined className="mr-1" />
                        {formatCompanyDate(property.completion_date)}
                    </Descriptions.Item>
                )}
            </Descriptions>
        </Card>
    );
}
