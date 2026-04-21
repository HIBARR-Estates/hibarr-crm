import React from "react";
import { Card, Tag, Empty, Spin, Timeline } from "antd";
import { motion } from "framer-motion";
import { ArrowUp, Crown } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import { useMyUplines } from "@/Features/Mlm/api";
import type { AgentHierarchyNode } from "@/Features/Mlm/types";

interface Props extends PageProps {
    uplines: AgentHierarchyNode[];
}

const MyUplines: React.FC<Props> = ({ uplines: initialUplines }) => {
    const { t } = useTranslation();
    const { data, isLoading } = useMyUplines();
    const uplines: AgentHierarchyNode[] =
        (data as any)?.data ?? initialUplines ?? [];

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.mlm.agent.uplines")}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/agent/dashboard" },
                    { name: t("app.mlm.agent.uplines") },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <Card
                            title={
                                <div className="flex items-center gap-2">
                                    <ArrowUp
                                        size={18}
                                        className="text-indigo-500"
                                    />
                                    <span className="font-semibold">
                                        Upline Chain
                                    </span>
                                </div>
                            }
                            extra={
                                <span className="text-sm text-gray-500">
                                    {uplines.length} level
                                    {uplines.length !== 1 ? "s" : ""} above you
                                </span>
                            }
                            className="shadow-sm"
                        >
                            <Spin spinning={isLoading}>
                                {uplines.length > 0 ? (
                                    <Timeline
                                        mode="left"
                                        items={uplines.map((upline, idx) => ({
                                            color:
                                                idx === 0
                                                    ? "blue"
                                                    : idx === uplines.length - 1
                                                      ? "gold"
                                                      : "gray",
                                            dot:
                                                idx === uplines.length - 1 ? (
                                                    <Crown
                                                        size={16}
                                                        className="text-yellow-500"
                                                    />
                                                ) : undefined,
                                            label: (
                                                <span className="text-xs text-gray-400">
                                                    Depth {idx + 1}
                                                </span>
                                            ),
                                            children: (
                                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                                                        {upline.name?.charAt(
                                                            0,
                                                        ) ?? "?"}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-medium">
                                                            {upline.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {upline.email}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {upline.level_name ? (
                                                            <Tag color="blue">
                                                                {
                                                                    upline.level_name
                                                                }
                                                            </Tag>
                                                        ) : (
                                                            <Tag>Unranked</Tag>
                                                        )}
                                                    </div>
                                                </div>
                                            ),
                                        }))}
                                    />
                                ) : (
                                    <Empty description="You are a root agent — no uplines above you." />
                                )}
                            </Spin>
                        </Card>
                    </motion.div>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MyUplines;
