import React from "react";
import { Card, Table, Tag, Empty, Button, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined, GiftOutlined } from "@ant-design/icons";
import { router } from "@inertiajs/react";
import type {
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import type { Offer } from "@/Types/api/offers";
import OfferAttachSection from "./OfferAttachSection";

const { Title } = Typography;

interface ProjectOffersSectionProps {
    project: DeveloperProject;
    unitTypes: DeveloperProjectUnitType[];
}

const ProjectOffersSection: React.FC<ProjectOffersSectionProps> = ({
    project,
    unitTypes,
}) => {
    const handleRefresh = () => {
        router.reload();
    };

    const projectOffer =
        project.offers && project.offers.length > 0
            ? (project.offers.find((o) => o.is_active) ?? project.offers[0])
            : null;

    const unitTypeColumns: TableColumnsType<DeveloperProjectUnitType> = [
        {
            title: "Unit Type",
            key: "label",
            render: (_, record) =>
                record.display_label ||
                `${record.primary_category} - ${record.property_type || "N/A"}`,
        },
        {
            title: "Beds",
            dataIndex: "bedrooms",
            key: "bedrooms",
            width: 60,
            align: "center",
            render: (v: number | null) => v ?? "-",
        },
        {
            title: "Price",
            key: "price",
            width: 120,
            align: "right",
            render: (_, record) =>
                record.starting_price
                    ? `${record.currency_symbol || ""}${Number(record.starting_price).toLocaleString("en-GB")}`
                    : "-",
        },
        {
            title: "Offer",
            key: "offer",
            width: 200,
            render: (_, record) => {
                const offer =
                    record.offers && record.offers.length > 0
                        ? (record.offers.find((o) => o.is_active) ??
                          record.offers[0])
                        : null;
                if (!offer) return <span className="text-gray-400">-</span>;
                return (
                    <Tag
                        color={offer.type === "percentage" ? "blue" : "green"}
                        icon={<GiftOutlined />}
                    >
                        {offer.name} (
                        {offer.type === "percentage"
                            ? `${offer.value}%`
                            : Number(offer.value).toLocaleString("en-GB")}
                        )
                    </Tag>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            {/* Project-Level Offer */}
            <Card title="Project Offer" size="small">
                <OfferAttachSection
                    currentOffer={projectOffer}
                    offerableType="developer_project"
                    offerableId={project.id}
                    onRefresh={handleRefresh}
                />
            </Card>

            {/* Unit Type Offers Overview */}
            <Card
                title="Unit Type Offers"
                size="small"
                extra={
                    <Button
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => router.visit(route("offers.index"))}
                    >
                        Manage Offers
                    </Button>
                }
            >
                {unitTypes.length > 0 ? (
                    <Table
                        columns={unitTypeColumns}
                        dataSource={unitTypes}
                        rowKey="id"
                        pagination={false}
                        size="small"
                    />
                ) : (
                    <Empty
                        description="No unit types defined"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                )}
            </Card>
        </div>
    );
};

export default ProjectOffersSection;
