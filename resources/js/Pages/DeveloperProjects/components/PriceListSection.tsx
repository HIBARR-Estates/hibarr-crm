import React from "react";
import { Link } from "@inertiajs/react";
import { Card, Table, Tabs, Tag, Empty, Typography } from "antd";
import type { PriceListItem } from "../Show";
import { snakeToReadable } from "../../../lib/utils";

const { Text } = Typography;

const PriceListSection: React.FC<{ priceList: PriceListItem[] }> = ({ priceList }) => {
    const formatPrice = (price: number | null) => {
        if (!price) return "-";
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
            maximumFractionDigits: 0,
        }).format(price);
    };

    if (priceList.length === 0) {
        return (
            <Card title="Price List">
                <Empty description="No properties with pricing found" />
            </Card>
        );
    }

    return (
        <Card title="Price List by Property Type">
            <Tabs
                items={priceList.map((item) => ({
                    key: item.type,
                    label: (
                        <span>
                            {snakeToReadable(item.type)} <Tag>{item.count}</Tag>
                        </span>
                    ),
                    children: (
                        <div>
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                                <Text strong>Price Range: </Text>
                                {item.min_price === item.max_price ? (
                                    formatPrice(item.min_price)
                                ) : (
                                    <>
                                        {formatPrice(item.min_price)} –{" "}
                                        {formatPrice(item.max_price)}
                                    </>
                                )}
                            </div>
                            <Table
                                dataSource={item.properties}
                                rowKey="id"
                                size="small"
                                pagination={{ pageSize: 5 }}
                                columns={[
                                    {
                                        title: "Property",
                                        dataIndex: "title",
                                        key: "title",
                                        render: (title: string, record) => (
                                            <Link href={route("properties.show", record.id)}>
                                                {title || `Property #${record.id}`}
                                            </Link>
                                        ),
                                    },
                                    {
                                        title: "Beds",
                                        dataIndex: "bedrooms",
                                        key: "bedrooms",
                                        align: "center",
                                    },
                                    {
                                        title: "Baths",
                                        dataIndex: "bathrooms",
                                        key: "bathrooms",
                                        align: "center",
                                    },
                                    {
                                        title: "Price",
                                        dataIndex: "price",
                                        key: "price",
                                        render: (price: number | null) => formatPrice(price),
                                    },
                                    {
                                        title: "Status",
                                        dataIndex: "status",
                                        key: "status",
                                        render: (status: string) => {
                                            const colors: Record<string, string> = {
                                                Available: "green",
                                                "Under offer": "orange",
                                                Sold: "red",
                                                Withdrawn: "default",
                                            };
                                            return <Tag color={colors[status]}>{status}</Tag>;
                                        },
                                    },
                                ]}
                            />
                        </div>
                    ),
                }))}
            />
        </Card>
    );
};

export default PriceListSection;
