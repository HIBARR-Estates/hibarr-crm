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
    DeleteOutlined,
    GiftOutlined,
} from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import type { Deal } from "@/Types/api/deals";
import type { DealOfferApplication } from "@/Types/api/offers";
import { getDealValueInsight } from "@/Features/Deals/utils/valueInsights";

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
    const insight = getDealValueInsight(deal);
    const currencySymbol = deal.currency?.currency_symbol || "£";

    const formatMoney = (value: number | null) => {
        if (value === null || value === undefined) {
            return "--";
        }
        return `${currencySymbol}${Number(value).toLocaleString("en-GB")}`;
    };

    const { data, isLoading, refetch } = useApiQuery<DealOffersResponse>({
        path: route("deals.offers.index", deal.id),
    });

    const applications = data?.data?.applications ?? [];
    const totalDiscount = data?.data?.total_discount ?? 0;

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

    const columns: TableColumnsType<DealOfferApplication> = [
        {
            title: "Property",
            key: "product",
            render: (_, record) =>
                (record.product as any)?.property?.title ||
                record.product?.name ||
                `Product #${record.product_id}`,
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
                    <Text type="secondary" className="text-xs">
                        Offers are applied when attaching a property from a
                        project. Use the Properties section to attach properties
                        with offers.
                    </Text>
                </Empty>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            <div className="rounded-md border border-gray-200 p-3 bg-gray-50">
                <Space size={24} wrap>
                    <div>
                        <Text type="secondary">Final</Text>
                        <div>
                            <Text strong>
                                {formatMoney(insight.finalValue)}
                            </Text>
                        </div>
                    </div>
                    <div>
                        <Text type="secondary">Base</Text>
                        <div>
                            <Text>{formatMoney(insight.baseTotal)}</Text>
                        </div>
                    </div>
                    <div>
                        <Text type="secondary">Discount</Text>
                        <div>
                            <Text type="success">
                                -{formatMoney(insight.discountTotal)}
                            </Text>
                        </div>
                    </div>
                    <div>
                        <Text type="secondary">Calculated</Text>
                        <div>
                            <Text>{formatMoney(insight.calculatedValue)}</Text>
                        </div>
                    </div>
                </Space>
            </div>

            <div className="flex items-center justify-between">
                <Text strong>Applied Offers</Text>
                <Space>
                    <Popconfirm
                        title="Remove all applied offers from this deal? You can re-apply offers by re-attaching properties."
                        onConfirm={handleRemoveAll}
                        okText="Remove"
                        okType="danger"
                        disabled={deal.is_locked}
                    >
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            disabled={deal.is_locked}
                        >
                            Clear All Offers
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
                        <Table.Summary.Cell index={0} colSpan={4} align="right">
                            <Text strong>Total Discount</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="right">
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
