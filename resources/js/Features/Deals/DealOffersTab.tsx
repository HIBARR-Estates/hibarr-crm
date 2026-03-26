import React from "react";
import {
    Table,
    Tag,
    Button,
    Popconfirm,
    Empty,
    Space,
    Typography,
    App,
} from "antd";
import type { TableColumnsType } from "antd";
import {
    ReloadOutlined,
    DeleteOutlined,
    GiftOutlined,
} from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import type { Deal } from "@/Types/api/deals";
import type { DealOfferApplication } from "@/Types/api/offers";
import { router } from "@inertiajs/react";

const { Text } = Typography;

interface DealOffersTabProps {
    deal: Deal;
}

interface DealOffersResponse {
    status: string;
    data: {
        applications: DealOfferApplication[];
        total_discount: number;
    };
}

const DealOffersTab: React.FC<DealOffersTabProps> = ({ deal }) => {
    const { message } = App.useApp();

    const { data, isLoading, refetch } = useApiQuery<DealOffersResponse>({
        path: route("deals.offers.index", deal.id),
    });

    const applications = data?.data?.applications ?? [];
    const totalDiscount = data?.data?.total_discount ?? 0;

    const handleRecalculate = async () => {
        try {
            const res = await fetch(route("deals.offers.apply", deal.id), {
                method: "POST",
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN":
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute("content") ?? "",
                    Accept: "application/json",
                },
            });
            const result = await res.json();
            if (result.status === "success") {
                message.success("Offers recalculated");
                refetch();
            } else {
                message.error(result.message || "Failed to recalculate");
            }
        } catch {
            message.error("Failed to recalculate offers");
        }
    };

    const handleRemoveAll = async () => {
        try {
            const res = await fetch(route("deals.offers.remove", deal.id), {
                method: "DELETE",
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN":
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute("content") ?? "",
                    Accept: "application/json",
                },
            });
            const result = await res.json();
            if (result.status === "success") {
                message.success("All offers removed");
                refetch();
            }
        } catch {
            message.error("Failed to remove offers");
        }
    };

    const resolvedFromLabel = (app: DealOfferApplication) => {
        if (app.resolved_from_type?.includes("UnitType")) {
            return <Tag color="purple">Unit Type</Tag>;
        }
        if (app.resolved_from_type?.includes("DeveloperProject")) {
            return <Tag color="orange">Project</Tag>;
        }
        return <Tag>{app.resolved_from_type}</Tag>;
    };

    const columns: TableColumnsType<DealOfferApplication> = [
        {
            title: "Property",
            key: "product",
            render: (_, record) =>
                record.product?.name || `Product #${record.product_id}`,
        },
        {
            title: "Offer",
            key: "offer",
            render: (_, record) => (
                <Space>
                    <GiftOutlined className="text-green-600" />
                    {record.offer?.name || `Offer #${record.offer_id}`}
                </Space>
            ),
        },
        {
            title: "Source",
            key: "source",
            width: 120,
            render: (_, record) => resolvedFromLabel(record),
        },
        {
            title: "Type",
            key: "type",
            width: 100,
            render: (_, record) => (
                <Tag
                    color={
                        record.offer_type === "percentage" ? "blue" : "green"
                    }
                >
                    {record.offer_type === "percentage"
                        ? `${record.offer_value}%`
                        : `${Number(record.offer_value).toLocaleString("en-GB")}`}
                </Tag>
            ),
        },
        {
            title: "Original",
            dataIndex: "original_amount",
            key: "original_amount",
            width: 120,
            align: "right",
            render: (v: number) => Number(v).toLocaleString("en-GB"),
        },
        {
            title: "Discount",
            dataIndex: "discount_amount",
            key: "discount_amount",
            width: 120,
            align: "right",
            render: (v: number) => (
                <Text type="success">-{Number(v).toLocaleString("en-GB")}</Text>
            ),
        },
    ];

    if (applications.length === 0 && !isLoading) {
        return (
            <div className="p-6">
                <Empty
                    description="No offers applied to this deal"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                    <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={handleRecalculate}
                    >
                        Calculate Offers
                    </Button>
                </Empty>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <Text strong>Applied Offers</Text>
                <Space>
                    <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={handleRecalculate}
                    >
                        Recalculate
                    </Button>
                    <Popconfirm
                        title="Remove all offers from this deal?"
                        onConfirm={handleRemoveAll}
                        okText="Remove"
                        okType="danger"
                    >
                        <Button size="small" danger icon={<DeleteOutlined />}>
                            Remove All
                        </Button>
                    </Popconfirm>
                </Space>
            </div>

            <Table
                columns={columns}
                dataSource={applications}
                rowKey="id"
                loading={isLoading}
                pagination={false}
                size="small"
                summary={() => (
                    <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={5} align="right">
                            <Text strong>Total Discount</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={5} align="right">
                            <Text strong type="success">
                                -{Number(totalDiscount).toLocaleString("en-GB")}
                            </Text>
                        </Table.Summary.Cell>
                    </Table.Summary.Row>
                )}
            />
        </div>
    );
};

export default DealOffersTab;
