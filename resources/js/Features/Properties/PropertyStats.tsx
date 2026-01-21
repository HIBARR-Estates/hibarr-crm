import React from "react";
import { Card, Statistic, Row, Col, Divider } from "antd";
import {
    HomeOutlined,
    BankOutlined,
    AreaChartOutlined,
    CalendarOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";
import { usePage } from "@inertiajs/react";
import { formatCurrencyWithSymbol, parsePropertyPrice } from "@/lib/utils";

interface PropertyStatsProps {
    property: Property;
}

export default function PropertyStats({ property }: PropertyStatsProps) {
    const { props } = usePage<any>();
    const {
        default_currency_code: defaultCurrencyCode,
        default_currency_symbol: defaultCurrencySymbol,
        currencies = [],
    } = props || {};

    const { amount: priceAmount, currency: priceCurrency } = parsePropertyPrice(
        (property as any).price,
        defaultCurrencyCode || "TRY"
    );

    const priceSymbol =
        currencies.find((c: any) => c?.currency_code === priceCurrency)?.currency_symbol ||
        defaultCurrencySymbol ||
        "";

    const stats = [
        {
            title: "Price",
            value: formatCurrencyWithSymbol(priceAmount, priceSymbol),
            icon: <BankOutlined className="text-green-600" />,
            // Always show price (it can be 0 for legacy nulls)
            show: true,
        },
        {
            title: "Bedrooms",
            value: property.bedrooms || "N/A",
            icon: <HomeOutlined className="text-blue-600" />,
            show: !!property.bedrooms,
        },
        {
            title: "Bathrooms",
            value: property.bathrooms || "N/A",
            icon: <HomeOutlined className="text-blue-600" />,
            show: !!property.bathrooms,
        },
        {
            title: "Land Size",
            value: property.land_size ? `${property.land_size} m²` : "N/A",
            icon: <AreaChartOutlined className="text-green-600" />,
            show: !!property.land_size,
        },
        {
            title: "Floor Number",
            value: property.floor_number || "N/A",
            icon: <BankOutlined className="text-purple-600" />,
            show: !!property.floor_number,
        },
        {
            title: "Building Age",
            value: property.building_age ? `${property.building_age} years` : "N/A",
            icon: <CalendarOutlined className="text-orange-600" />,
            show: !!property.building_age,
        },
        {
            title: "Living Rooms",
            value: property.living_room || "N/A",
            icon: <HomeOutlined className="text-indigo-600" />,
            show: !!property.living_room,
        },
    ];

    const visibleStats = stats.filter(stat => stat.show);

    if (visibleStats.length === 0) {
        return null;
    }

    return (
        <Card title="Property Statistics" className="mb-6">
            <Row gutter={[24, 24]}>
                {visibleStats.map((stat, index) => (
                    <Col key={index} xs={12} sm={8} md={6}>
                        <div className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="text-2xl mb-2">{stat.icon}</div>
                            <Statistic
                                title={stat.title}
                                value={stat.value}
                                valueStyle={{ 
                                    fontSize: '1.5rem', 
                                    fontWeight: 'bold',
                                    color: '#1890ff'
                                }}
                            />
                        </div>
                    </Col>
                ))}
            </Row>

            {property.furniture_status && (
                <>
                    <Divider />
                    <Row gutter={[24, 16]}>
                        <Col span={24}>
                            <div className="text-center">
                                <Statistic
                                    title="Furniture Status"
                                    value={property.furniture_status}
                                    valueStyle={{ color: '#52c41a' }}
                                />
                            </div>
                        </Col>
                    </Row>
                </>
            )}
        </Card>
    );
}