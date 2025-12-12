import React from "react";
import { motion } from "framer-motion";
import { Card, List, Button, Empty, Progress, Tag } from "antd";
import { Link } from "@inertiajs/react";
import { AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
import { Typography } from "antd";

const { Text } = Typography;

interface Deal {
    id: number;
    name: string;
    value: number;
    pipeline_stage_id: number;
    created_at: string;
    updated_at: string;
    contact?: {
        client_name: string;
        client_email: string;
    };
    lead_stage?: {
        name: string;
        label_color: string;
    };
    currency?: {
        currency_symbol: string;
    };
    data_quality_score?: number;
    missing_fields?: string[];
}

interface DataQualityWidgetProps {
    deals: Deal[];
}

export default function DataQualityWidget({ deals }: DataQualityWidgetProps) {
    const getDataQualityColor = (score: number) => {
        if (score >= 80) return "#52c41a";
        if (score >= 50) return "#faad14";
        return "#ff4d4f";
    };

    const getQualityGradient = (score: number) => {
        if (score >= 80) return "from-green-400 to-emerald-500";
        if (score >= 50) return "from-yellow-400 to-orange-500";
        return "from-red-400 to-pink-500";
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="h-full"
        >
            <Card
                variant="outlined"
                className="h-full border-0 shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl"
                bodyStyle={{ padding: 0 }}
                title={
                    <div className="flex justify-between items-center p-6 pb-0">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                                <AlertTriangle
                                    size={18}
                                    className="text-orange-500"
                                />
                                Data Quality
                            </h3>
                            <p className="text-sm text-gray-500">
                                Deals that need attention
                            </p>
                        </div>
                        <Link
                            href={route("deals.index", {
                                sort_by: "data_quality",
                                sort_direction: "asc",
                            })}
                        >
                            <Button
                                type="text"
                                size="small"
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                                View All
                                <ArrowRight size={14} />
                            </Button>
                        </Link>
                    </div>
                }
            >
                <div className="p-6 pt-4">
                    <List
                        dataSource={deals}
                        locale={{
                            emptyText: (
                                <Empty
                                    description="All deals have good data quality!"
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    className="py-8"
                                />
                            ),
                        }}
                        split={false}
                        renderItem={(deal, index) => (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    duration: 0.3,
                                    delay: index * 0.1,
                                }}
                            >
                                <List.Item
                                    className="border-0 border-b border-gray-50 last:border-0 py-4 hover:bg-gray-25 px-2 rounded-lg transition-colors duration-200"
                                    actions={[
                                        <Link
                                            href={route("deals.edit", deal.id)}
                                            key="edit"
                                        >
                                            <Button
                                                type="primary"
                                                size="small"
                                                className="bg-gradient-to-r from-blue-500 to-purple-600 border-0 shadow-md hover:shadow-lg"
                                            >
                                                Complete
                                            </Button>
                                        </Link>,
                                    ]}
                                >
                                    <List.Item.Meta
                                        avatar={
                                            <div
                                                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getQualityGradient(
                                                    deal.data_quality_score || 0
                                                )} flex items-center justify-center`}
                                            >
                                                <TrendingUp
                                                    size={18}
                                                    className="text-white"
                                                />
                                            </div>
                                        }
                                        title={
                                            <span className="text-sm font-medium text-gray-900">
                                                {deal.name}
                                            </span>
                                        }
                                        description={
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <Progress
                                                        percent={
                                                            deal.data_quality_score ||
                                                            0
                                                        }
                                                        size="small"
                                                        strokeColor={getDataQualityColor(
                                                            deal.data_quality_score ||
                                                                0
                                                        )}
                                                        className="flex-1"
                                                        showInfo={false}
                                                    />
                                                    <span className="text-xs font-semibold text-gray-700">
                                                        {deal.data_quality_score ||
                                                            0}
                                                        %
                                                    </span>
                                                </div>
                                                {deal.missing_fields &&
                                                    deal.missing_fields.length >
                                                        0 && (
                                                        <div className="space-y-1">
                                                            <Text
                                                                type="secondary"
                                                                className="text-xs"
                                                            >
                                                                Missing fields:
                                                            </Text>
                                                            <div className="flex flex-wrap gap-1">
                                                                {deal.missing_fields
                                                                    .slice(0, 3)
                                                                    .map(
                                                                        (
                                                                            field,
                                                                            idx
                                                                        ) => (
                                                                            <Tag
                                                                                key={
                                                                                    idx
                                                                                }
                                                                                className="text-xs !m-0 bg-red-50 text-red-600 border-red-200"
                                                                            >
                                                                                {
                                                                                    field
                                                                                }
                                                                            </Tag>
                                                                        )
                                                                    )}
                                                                {deal
                                                                    .missing_fields
                                                                    .length >
                                                                    3 && (
                                                                    <Tag className="text-xs !m-0 bg-gray-50 text-gray-600 border-gray-200">
                                                                        +
                                                                        {deal
                                                                            .missing_fields
                                                                            .length -
                                                                            3}{" "}
                                                                        more
                                                                    </Tag>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                            </div>
                                        }
                                    />
                                </List.Item>
                            </motion.div>
                        )}
                    />
                </div>
            </Card>
        </motion.div>
    );
}
