import React from "react";
import { Card, Tabs, Tag, Empty, Typography } from "antd";
import { DataTable } from "@/Components/DataTable";
import type { UnitTypePriceListItem } from "../Show";
import { snakeToReadable } from "../../../lib/utils";

const { Text } = Typography;

const CURRENCY_LOCALE: Record<string, string> = {
    GBP: "en-GB",
    EUR: "de-DE",
    USD: "en-US",
    TRY: "tr-TR",
};

const PriceListSection: React.FC<{ priceList: UnitTypePriceListItem[] }> = ({
    priceList,
}) => {
    const formatPrice = (price: number | null, currency = "GBP") => {
        if (!price) return "-";
        return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-GB", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(price);
    };

    if (priceList.length === 0) {
        return (
            <Card title="Price List">
                <Empty description="No unit types with pricing found" />
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
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg flex items-center gap-4">
                                <div>
                                    <Text strong>Price Range: </Text>
                                    {item.min_price === item.max_price ? (
                                        formatPrice(
                                            item.min_price,
                                            item.currency,
                                        )
                                    ) : (
                                        <>
                                            {formatPrice(
                                                item.min_price,
                                                item.currency,
                                            )}{" "}
                                            –{" "}
                                            {formatPrice(
                                                item.max_price,
                                                item.currency,
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <DataTable
                                dataSource={item.unit_types}
                                rowKey="id"
                                size="small"
                                scroll={{ x: "max-content" }}
                                columns={[
                                    {
                                        title: "Reference",
                                        dataIndex: "reference_code",
                                        key: "reference_code",
                                        render: (code: string | null, record) =>
                                            code || `UT-${record.id}`,
                                    },
                                    {
                                        title: "Beds",
                                        dataIndex: "bedrooms",
                                        key: "bedrooms",
                                        align: "center",
                                        render: (v: number | null) => v ?? "-",
                                    },
                                    {
                                        title: "Baths",
                                        dataIndex: "bathrooms",
                                        key: "bathrooms",
                                        align: "center",
                                        render: (v: number | null) => v ?? "-",
                                    },
                                    {
                                        title: "Floor",
                                        dataIndex: "floor",
                                        key: "floor",
                                        align: "center",
                                        render: (v: string | null) => v ?? "-",
                                    },
                                    {
                                        title: "Area (m²)",
                                        dataIndex: "total_area_sqm",
                                        key: "total_area_sqm",
                                        align: "right",
                                        render: (v: number | null) =>
                                            v
                                                ? `${v.toLocaleString()} m²`
                                                : "-",
                                    },
                                    {
                                        title: "Qty",
                                        dataIndex: "quantity",
                                        key: "quantity",
                                        align: "center",
                                        render: (v: number | null) => v ?? "-",
                                    },
                                    {
                                        title: "Price",
                                        dataIndex: "formatted_price",
                                        key: "formatted_price",
                                        align: "right",
                                        render: (
                                            formatted: string | null,
                                            record,
                                        ) =>
                                            formatted ??
                                            formatPrice(
                                                record.starting_price,
                                                record.currency,
                                            ),
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
