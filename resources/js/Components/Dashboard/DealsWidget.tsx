import React from "react";
import { motion } from "framer-motion";
import { Card, List, Button, Empty, Tag } from "antd";
import { Link } from "@inertiajs/react";
import { EyeOutlined } from "@ant-design/icons";
import { DollarSign, TrendingUp, ArrowRight, Building } from "lucide-react";
import dayjs from "dayjs";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
}

interface DealsWidgetProps {
    deals: Deal[];
}

export default function DealsWidget({ deals }: DealsWidgetProps) {
    const { td } = useTd();
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="h-full"
        >
            <Card
                variant="outlined"
                className="h-full border-0 shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl"
                bodyStyle={{ padding: 0 }}
                title={
                    <div className="flex justify-between items-center p-6 pb-0">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {td("Recent Deals", { source: "en" })}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {td("Latest deal activities", { source: "en" })}
                            </p>
                        </div>
                        <Link href={route("deals.index")}>
                            <Button
                                type="text"
                                size="small"
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                                {td("View All", { source: "en" })}
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
                                    description={td("No deals found", { source: "en" })}
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
                                            href={route("deals.show", deal.id)}
                                            key="view"
                                        >
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<EyeOutlined />}
                                                className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                            >
                                                {td("View", { source: "en" })}
                                            </Button>
                                        </Link>,
                                    ]}
                                >
                                    <List.Item.Meta
                                        avatar={
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                                <Building
                                                    size={18}
                                                    className="text-white"
                                                />
                                            </div>
                                        }
                                        title={
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-900">
                                                    {deal.name}
                                                </span>
                                                {deal.lead_stage && (
                                                    <Tag
                                                        color={
                                                            deal.lead_stage
                                                                .label_color
                                                        }
                                                        className="text-xs"
                                                    >
                                                        {td(deal.lead_stage.name, { source: "en" })}
                                                    </Tag>
                                                )}
                                            </div>
                                        }
                                        description={
                                            <div className="space-y-2">
                                                {deal.contact && (
                                                    <div className="text-xs text-gray-500">
                                                        {
                                                            deal.contact
                                                                .client_name
                                                        }
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1">
                                                        <DollarSign
                                                            size={14}
                                                            className="text-green-600"
                                                        />
                                                        <span className="font-semibold text-green-600">
                                                            {
                                                                deal.currency
                                                                    ?.currency_symbol
                                                            }
                                                            {deal.value?.toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        {dayjs(
                                                            deal.updated_at
                                                        ).fromNow()}
                                                    </span>
                                                </div>
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
