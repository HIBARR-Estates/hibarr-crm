import React from "react";
import { Card, Tag, Empty, Button, Space } from "antd";
import { DataTable } from "@/Components/DataTable";
import type { TableColumnsType } from "antd";
import { PlusOutlined, GiftOutlined } from "@ant-design/icons";
import { router } from "@inertiajs/react";
import type {
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import type { Offer, OfferablePivot } from "@/Types/api/offers";
import OfferAttachSection from "./OfferAttachSection";
import { useTd } from "@/Hooks/useDynamicTranslation";

type OfferWithPivot = Offer & { pivot?: OfferablePivot };

interface ProjectOffersSectionProps {
    project: DeveloperProject & { offers?: OfferWithPivot[] };
    unitTypes: (DeveloperProjectUnitType & { offers?: OfferWithPivot[] })[];
}

const ProjectOffersSection: React.FC<ProjectOffersSectionProps> = ({
    project,
    unitTypes,
}) => {
    const { td } = useTd();
    const handleRefresh = () => {
        router.reload();
    };

    const unitTypeColumns: TableColumnsType<
        DeveloperProjectUnitType & { offers?: OfferWithPivot[] }
    > = [
        {
            title: td("Unit Type", { source: "en" }),
            key: "label",
            render: (_, record) =>
                record.display_label ||
                `${record.primary_category} - ${record.property_type || "N/A"}`,
        },
        {
            title: td("Beds", { source: "en" }),
            dataIndex: "bedrooms",
            key: "bedrooms",
            width: 60,
            align: "center",
            render: (v: number | null) => v ?? "-",
        },
        {
            title: td("Price", { source: "en" }),
            key: "price",
            width: 120,
            align: "right",
            render: (_, record) =>
                record.starting_price
                    ? `${record.currency_symbol || ""}${Number(record.starting_price).toLocaleString("en-GB")}`
                    : "-",
        },
        {
            title: td("Offers", { source: "en" }),
            key: "offers",
            width: 280,
            render: (_, record) => {
                const offers = (record.offers ?? []) as OfferWithPivot[];
                if (offers.length === 0)
                    return <span className="text-gray-400">—</span>;
                return (
                    <Space size={[4, 4]} wrap>
                        {offers.map((offer) => {
                            const active =
                                offer.pivot?.is_active !== false &&
                                offer.is_active;
                            return (
                                <Tag
                                    key={offer.id}
                                    color={
                                        !active
                                            ? "default"
                                            : offer.type === "percentage"
                                              ? "blue"
                                              : offer.type === "perks"
                                                ? "purple"
                                                : "green"
                                    }
                                    icon={<GiftOutlined />}
                                >
                                    {offer.name} (
                                    {offer.type === "perks"
                                        ? "Perk"
                                        : offer.type === "percentage"
                                          ? `${offer.value}%`
                                          : Number(offer.value).toLocaleString(
                                                "en-GB",
                                            )}
                                    ){!active && " · Disabled"}
                                </Tag>
                            );
                        })}
                    </Space>
                );
            },
        },
    ];

    return (
        <div className="flex flex-col gap-y-6">
            {/* Project-Level Offers */}
            <Card title={td("Project Offers", { source: "en" })} size="small">
                <OfferAttachSection
                    offers={(project.offers ?? []) as OfferWithPivot[]}
                    offerableType="developer_project"
                    offerableId={project.id}
                    onRefresh={handleRefresh}
                />
            </Card>

            {/* Unit Type Offers Overview */}
            <Card
                title={td("Unit Type Offers", { source: "en" })}
                size="small"
                extra={
                    <Button
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => router.visit(route("offers.index"))}
                    >
                        {td("Manage Offers", { source: "en" })}
                    </Button>
                }
            >
                {unitTypes.length > 0 ? (
                    <DataTable
                        columns={unitTypeColumns}
                        dataSource={unitTypes}
                        rowKey="id"
                        size="small"
                        scroll={{ x: "max-content" }}
                        expandable={{
                            expandedRowRender: (record) => (
                                <OfferAttachSection
                                    offers={
                                        (record.offers ??
                                            []) as OfferWithPivot[]
                                    }
                                    offerableType="unit_type"
                                    offerableId={record.id}
                                    onRefresh={handleRefresh}
                                />
                            ),
                        }}
                    />
                ) : (
                    <Empty
                        description={td("No unit types defined", { source: "en" })}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                )}
            </Card>
        </div>
    );
};

export default ProjectOffersSection;
