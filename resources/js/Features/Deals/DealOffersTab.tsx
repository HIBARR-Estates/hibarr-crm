import React from "react";
import { Table, Tag, Button, Popconfirm, Empty, Space, Typography } from "antd";
import { DataTable } from "@/Components/DataTable";
import type { TableColumnsType } from "antd";
import { DeleteOutlined, GiftOutlined } from "@ant-design/icons";
import { useApiMutate, useApiQuery } from "@/lib/api/client";
import type { Deal } from "@/Types/api/deals";
import type { DealOfferApplication, DealOffersResponse } from "@/Types/api/offers";
import type { ApiResponse } from "@/lib/api/types";
import { getDealValueInsight } from "@/Features/Deals/utils/valueInsights";
import { generatePropertySubtitle } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Text } = Typography;

interface DealOffersTabProps {
    deal: Deal;
}

const DealOffersTab: React.FC<DealOffersTabProps> = ({ deal }) => {
    const { td } = useTd();
    const insight = getDealValueInsight(deal);
    const currencySymbol = deal.currency?.currency_symbol || "£";

    const formatMoney = (value: number | null) => {
        if (value === null || value === undefined) {
            return "--";
        }
        return `${currencySymbol}${Number(value).toLocaleString("en-GB")}`;
    };

    const { data, isLoading, isError, refetch } =
        useApiQuery<DealOffersResponse>({
            path: route("deals.offers.index", deal.id),
        });

    const { mutate: removeAllOffers, isPending: isRemovingAllOffers } =
        useApiMutate<undefined, unknown, ApiResponse<unknown>>(
            route("deals.offers.remove", deal.id),
            "DELETE",
            () => {
                refetch();
            },
        );

    const applications = data?.applications ?? [];
    const totalDiscount = data?.total_discount ?? 0;

    const handleRemoveAll = () => {
        removeAllOffers(undefined);
    };

    const columns: TableColumnsType<DealOfferApplication> = [
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
            title: "Property",
            key: "product",
            render: (_, record) =>
                generatePropertySubtitle((record.product as any)?.property) ||
                record.product?.name ||
                `Product #${record.product_id}`,
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
                    className="capitalize"
                >
                    {record.offer_type}
                </Tag>
            ),
        },
        // {
        //     title: "Original",
        //     dataIndex: "original_amount",
        //     key: "original_amount",
        //     width: 120,
        //     align: "right",
        //     render: (v: number) => formatMoney(v),
        // },
        {
            title: "Discount",
            dataIndex: "discount_amount",
            key: "discount_amount",
            width: 120,
            align: "right",
            render: (v: number) => (
                <Text type="success">-{formatMoney(v)}</Text>
            ),
        },
    ];

    // A failed fetch must not read as "no offers applied" — show a retry
    // action instead of the empty state.
    if (isError && applications.length === 0 && !isLoading) {
        return (
            <div className="p-6">
                <Empty
                    description={td("Failed to load offers", { source: "en" })}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                    <Button size="small" onClick={() => refetch()}>
                        {td("Retry", { source: "en" })}
                    </Button>
                </Empty>
            </div>
        );
    }

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
                            loading={isRemovingAllOffers}
                        >
                            Clear All Offers
                        </Button>
                    </Popconfirm>
                </Space>
            </div>

            <DataTable
                columns={columns}
                dataSource={applications}
                rowKey="id"
                loading={isLoading}
                size="small"
                scroll={{ x: "max-content" }}
                summary={() => (
                    <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={4} align="right">
                            <Text strong>Total Discount</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="right">
                            <Text strong type="success">
                                -{formatMoney(totalDiscount)}
                            </Text>
                        </Table.Summary.Cell>
                    </Table.Summary.Row>
                )}
            />
        </div>
    );
};

export default DealOffersTab;
